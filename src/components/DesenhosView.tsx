import { FileDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { assinaturaDesenho } from '../cutplan/desenho';
import { DesenhoPeca } from '../cutplan/DesenhoPeca';
import type { Catalogo, Peca } from '../domain/types';
import { calcularFuracao, NOMES_USINAGEM, type Furo, type PadroesUsinagem, type TipoUsinagem } from '../domain/usinagem';
import { COR_FURO } from '../cutplan/desenho';
import { Botao } from './ui';

export function useItensDesenho(pecas: Peca[], numeros: Map<string, string>, usinagem?: PadroesUsinagem) {
  return useMemo(() => {
    const furos = calcularFuracao(pecas, usinagem);
    // peças idênticas (mesma medida, fita e furação) viram um desenho só: "P5, P6"
    const grupos = new Map<string, { peca: Peca; nums: string[]; quantidade: number; furos: Furo[] }>();
    for (const p of pecas) {
      if (p.somente3d) continue;
      const fs = furos.get(p.id) ?? [];
      const k = assinaturaDesenho(p, fs);
      const g = grupos.get(k);
      if (g) {
        g.quantidade += p.quantidade;
        g.nums.push(numeros.get(p.id) ?? '');
      } else grupos.set(k, { peca: p, nums: [numeros.get(p.id) ?? ''], quantidade: p.quantidade, furos: fs });
    }
    return [...grupos.values()].map(({ nums, ...g }) => ({ ...g, numero: nums.join(', ') }));
  }, [pecas, numeros, usinagem]);
}

export function DesenhosView({ pecas, numeros, catalogo, projeto, usinagem }: { pecas: Peca[]; numeros: Map<string, string>; catalogo: Catalogo; projeto: string; usinagem?: PadroesUsinagem }) {
  const itens = useItensDesenho(pecas, numeros, usinagem);
  const [gerando, setGerando] = useState(false);

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-tinta-2">
          {(Object.keys(COR_FURO) as TipoUsinagem[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border-2" style={{ borderColor: COR_FURO[t] }} />
              {NOMES_USINAGEM[t]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded bg-mdf" /> fita de borda
          </span>
          <span className="text-tinta-3">tracejado = na outra face ou no topo</span>
        </div>
        <Botao
          disabled={gerando || !itens.length}
          onClick={async () => {
            setGerando(true);
            try {
              const { pdfDesenhos } = await import('../export/exportar');
              await pdfDesenhos({ projeto, itens, chapas: catalogo.chapas, fitas: catalogo.fitas });
            } finally {
              setGerando(false);
            }
          }}
        >
          <FileDown className="size-4" /> {gerando ? 'Gerando…' : 'Baixar desenhos (PDF)'}
        </Botao>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {itens.map((it) => (
          <DesenhoPeca key={`${it.numero}-${it.peca.id}`} peca={it.peca} numero={it.numero} quantidade={it.quantidade} furos={it.furos} chapa={catalogo.chapas.find((c) => c.id === it.peca.chapaId)} fitas={catalogo.fitas} />
        ))}
      </div>
      {!itens.length && <p className="text-tinta-2">Sem peças para desenhar.</p>}
    </div>
  );
}
