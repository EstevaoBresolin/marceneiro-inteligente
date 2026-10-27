import { ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { limitesDe, moduloDaPeca, type ProjetoMontado } from '../domain/composicao';
import { gerarManual } from '../domain/manual';
import type { Catalogo } from '../domain/types';
import type { CenaHandle } from '../viewer3d/Scene';
import { Botao, cx } from './ui';

const Cena = lazy(() => import('../viewer3d/Scene').then((m) => ({ default: m.Cena })));
const OPCOES = { portaAberta: false, explodida: false, transparente: false, cotas: false };
const nada = () => {};
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ManualView({ montado, catalogo, numeros, projeto, exportarAoAbrir, onExportado }: { montado: ProjetoMontado; catalogo: Catalogo; numeros: Map<string, string>; projeto: string; exportarAoAbrir?: boolean; onExportado?: () => void }) {
  const passos = useMemo(() => gerarManual(montado, catalogo, numeros), [montado, catalogo, numeros]);
  const [i, setI] = useState(0);
  const [gerando, setGerando] = useState(false);
  const cena = useRef<CenaHandle>(null);
  const passo = passos[Math.min(i, passos.length - 1)];

  const visiveis = useMemo(() => new Set(passo?.visiveis ?? []), [passo]);
  const pecas = useMemo(() => montado.pecas.filter((p) => visiveis.has(p.id)), [montado.pecas, visiveis]);
  const marcadas = useMemo(() => Object.fromEntries((passo?.novas ?? []).map((id) => [id, 'passo' as const])), [passo]);
  const rotulos = useMemo(() => Object.fromEntries((passo?.novas ?? []).filter((id) => numeros.has(id)).map((id) => [id, numeros.get(id)!])), [passo, numeros]);
  // enquadra o módulo do passo atual (a câmera pula quando muda de módulo)
  const moduloDoPasso = passo?.novas[0] ? moduloDaPeca(passo.novas[0]) : null;
  const limitesPasso = useMemo(() => {
    const doMod = montado.pecas.filter((p) => p.box3d && (!moduloDoPasso || moduloDaPeca(p.id) === moduloDoPasso));
    return limitesDe(doMod.map((p) => p.box3d!)) ?? montado.limites;
  }, [montado, moduloDoPasso]);
  const seqCamera = montado.modulos.findIndex((m) => m.modulo.id === moduloDoPasso) + 1;
  const modulos = useMemo(() => montado.modulos.map((m) => ({ id: m.modulo.id, nome: m.modulo.nome, limitesLocais: m.limitesLocais, posicao: m.modulo.posicao })), [montado.modulos]);

  const baixar = async () => {
    setGerando(true);
    const atual = i;
    try {
      const imagens: (string | null)[] = [];
      for (let k = 0; k < passos.length; k++) {
        setI(k);
        await esperar(700); // deixa o 3D desenhar o passo
        imagens.push(cena.current?.capturarPng() ?? null);
      }
      const { pdfManual } = await import('../export/exportar');
      const lista = montado.pecas.filter((p) => !p.somente3d).map((p) => ({ numero: numeros.get(p.id) ?? '', nome: p.nome, medida: `${p.comprimento} × ${p.largura}` }));
      await pdfManual({ projeto, passos, imagens, listaPecas: lista });
    } finally {
      setI(atual);
      setGerando(false);
      onExportado?.();
    }
  };

  useEffect(() => {
    if (exportarAoAbrir && passos.length) {
      const t = setTimeout(baixar, 900);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportarAoAbrir]);

  if (!passo) return <p className="p-4 text-tinta-2">Adicione um módulo para gerar o manual.</p>;

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[240px_1fr]">
      <ol className="space-y-0.5 text-[13px]">
        {passos.map((ps, k) => (
          <li key={k}>
            <button onClick={() => setI(k)} className={cx('flex w-full gap-2 rounded px-2 py-1.5 text-left', k === i ? 'bg-[#f6e7d6] font-medium text-tinta' : 'text-tinta-2 hover:bg-painel-2')}>
              <span className={cx('grid size-5 shrink-0 place-items-center rounded-full font-cond text-[11px] font-bold', k === i ? 'bg-[#b5641f] text-white' : 'bg-painel-2 text-tinta-3')}>{k + 1}</span>
              <span>{ps.titulo}</span>
            </button>
          </li>
        ))}
      </ol>

      <div>
        <div className="relative isolate h-[380px] overflow-hidden rounded-lg border border-linha">
          <Suspense fallback={<div className="grid h-full place-items-center text-tinta-3">Carregando 3D…</div>}>
            <Cena
              ref={cena}
              pecas={pecas}
              chapas={catalogo.chapas}
              limites={limitesPasso}
              modulos={modulos}
              ferramenta="mao"
              sel={{ modulo: null, peca: null }}
              onSelecionar={nada}
              onMoverModulo={nada}
              onMoverPeca={nada}
              opcoes={OPCOES}
              vista="iso"
              vistaSeq={seqCamera}
              marcadas={marcadas}
              rotulos={rotulos}
              somenteVer
            />
          </Suspense>
          <div className="absolute bottom-3 right-3 flex gap-1">
            <Botao tamanho="sm" onClick={() => setI((k) => Math.max(0, k - 1))} disabled={i === 0} aria-label="Passo anterior">
              <ChevronLeft className="size-4" />
            </Botao>
            <Botao tamanho="sm" onClick={() => setI((k) => Math.min(passos.length - 1, k + 1))} disabled={i >= passos.length - 1} aria-label="Próximo passo">
              <ChevronRight className="size-4" />
            </Botao>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h3 className="font-cond text-lg font-semibold">
              {i + 1}. {passo.titulo}
            </h3>
            <p className="mt-1 text-[14px] text-tinta-2">{passo.texto}</p>
            {passo.pecas.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
                {passo.pecas.map((p) => (
                  <li key={p.numero + p.nome} className="rounded border border-[#e7c9a6] bg-[#fbf3ea] px-1.5 py-0.5">
                    <b className="font-cond">{p.numero}</b> {p.nome} <span className="text-tinta-3 num">{p.medida}</span>
                  </li>
                ))}
              </ul>
            )}
            {passo.ferragens.length > 0 && <p className="mt-2 text-[12px] text-tinta-2">Ferragens: {passo.ferragens.map((f) => `${f.qtd}× ${f.nome}`).join(', ')}</p>}
          </div>
          <Botao onClick={baixar} disabled={gerando}>
            <FileDown className="size-4" /> {gerando ? `Gerando passo ${i + 1}/${passos.length}…` : 'Baixar manual (PDF)'}
          </Botao>
        </div>
      </div>
    </div>
  );
}
