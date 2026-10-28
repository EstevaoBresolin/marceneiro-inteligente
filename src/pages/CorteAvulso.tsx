import { FileDown, FileSpreadsheet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CustosView } from '../components/CustosView';
import { TabelaPecas } from '../components/TabelaPecas';
import { Abas, Botao, Campo, NumeroInput, Painel, Selecao, Titulo } from '../components/ui';
import { calcularCustos } from '../costing/calcularCustos';
import { PlanoCorteView } from '../cutplan/PlanoCorteView';
import type { Peca } from '../domain/types';
import { rastrear } from '../lib/telemetria';
import { parsePecas } from '../lib/parsePecas';
import { usePlanoCorte } from '../lib/usePlanoCorte';
import { useApp } from '../store/app';

const exportar = () => import('../export/exportar');

const EXEMPLO = '600x250x10\n400x120x4';
const CHAVE = 'corte-avulso';

type Salvo = { texto: string; chapaId: string; fitaId: string; bordasPadrao: string; horas: number };

export function CorteAvulso() {
  const { catalogo, config } = useApp();
  const inicial = useMemo<Salvo>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
      if (s) return s;
    } catch {
      /* ignora */
    }
    return { texto: EXEMPLO, chapaId: catalogo.chapas[0]?.id ?? '', fitaId: catalogo.fitas[0]?.id ?? '', bordasPadrao: 'c1', horas: 0 };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [s, setS] = useState<Salvo>(inicial);
  const [ajustes, setAjustes] = useState<Record<number, Peca>>({});
  const [aba, setAba] = useState<'corte' | 'custos' | 'pecas'>('corte');

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(s));
    } catch {
      /* ignora */
    }
  }, [s]);

  const { linhas, erros } = useMemo(() => parsePecas(s.texto), [s.texto]);
  const chapa = catalogo.chapas.find((c) => c.id === s.chapaId) ?? catalogo.chapas[0];

  const pecas: Peca[] = useMemo(
    () =>
      linhas.map((l, i) => {
        const fita = s.fitaId || null;
        const base: Peca = {
          id: `linha-${i}`,
          nome: l.nome ?? `Peça ${i + 1}`,
          chapaId: chapa?.id ?? '',
          comprimento: l.comprimento,
          largura: l.largura,
          quantidade: l.quantidade,
          podeGirar: !chapa?.temVeio,
          bordas: {
            c1: ['c1', 'c1c2', 'todas'].includes(s.bordasPadrao) ? fita : null,
            c2: ['c1c2', 'todas'].includes(s.bordasPadrao) ? fita : null,
            l1: s.bordasPadrao === 'todas' ? fita : null,
            l2: s.bordasPadrao === 'todas' ? fita : null,
          },
          furos: [],
        };
        const a = ajustes[i];
        return a && a.comprimento === l.comprimento && a.largura === l.largura ? { ...a, quantidade: l.quantidade } : base;
      }),
    [linhas, chapa, s.fitaId, s.bordasPadrao, ajustes],
  );

  const { plano, calculando } = usePlanoCorte(pecas, 1, catalogo.chapas, config.servico.kerf, config.servico.refilo);
  const custos = useMemo(() => calcularCustos({ pecas, lote: 1, ferragens: [], extras: [], horasMaoDeObra: s.horas, plano, catalogo, config }), [pecas, s.horas, plano, catalogo, config]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8">
      <Titulo sub="Cole ou digite as peças, uma por linha. O plano de corte e o custo saem na hora, sem precisar criar projeto.">Plano de corte avulso</Titulo>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Painel className="p-4 space-y-4 self-start">
          <Campo label="Peças" dica="Formatos: 600x250x10 · 600 250 10 Prateleira · Lateral;600;147;2. Medidas em mm.">
            <textarea
              aria-label="Lista de peças"
              className="h-44 w-full rounded-md border border-linha bg-painel p-2.5 font-cond text-[15px] leading-relaxed outline-none focus:border-aco focus:ring-2 focus:ring-aco-claro num"
              value={s.texto}
              onChange={(e) => setS({ ...s, texto: e.target.value })}
              spellCheck={false}
            />
          </Campo>
          {erros.length > 0 && (
            <ul className="text-[13px] text-perigo">
              {erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <Campo label="Chapa">
            <Selecao ariaLabel="Chapa" valor={chapa?.id ?? ''} onChange={(v) => setS({ ...s, chapaId: v })} opcoes={catalogo.chapas.map((c) => ({ valor: c.id, label: `${c.nome} (${c.largura}×${c.altura})` }))} />
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Fita de borda">
              <Selecao ariaLabel="Fita" valor={s.fitaId} onChange={(v) => setS({ ...s, fitaId: v })} opcoes={[{ valor: '', label: 'Sem fita' }, ...catalogo.fitas.map((f) => ({ valor: f.id, label: f.nome }))]} />
            </Campo>
            <Campo label="Em quais lados">
              <Selecao
                ariaLabel="Lados com fita"
                valor={s.bordasPadrao}
                onChange={(v) => setS({ ...s, bordasPadrao: v })}
                opcoes={[
                  { valor: 'c1', label: '1 comprimento' },
                  { valor: 'c1c2', label: '2 comprimentos' },
                  { valor: 'todas', label: '4 lados' },
                  { valor: 'nenhum', label: 'Nenhum' },
                ]}
              />
            </Campo>
          </div>
          <Campo label="Mão de obra total" unidade="h">
            <NumeroInput ariaLabel="Horas de mão de obra" valor={s.horas} min={0} passo={0.5} onChange={(v) => setS({ ...s, horas: v })} />
          </Campo>
          <div className="flex flex-wrap gap-2 border-t border-linha pt-4">
            <Botao onClick={async () => {
              rastrear('exportou', { tipo: 'corte', avulso: true });
              await (await exportar()).pdfPlanoCorte({ projeto: 'Plano de corte avulso', plano, pecas, fitas: catalogo.fitas, lote: 1 });
            }} disabled={!pecas.length}>
              <FileDown className="size-4" /> PDF
            </Botao>
            <Botao onClick={async () => (await exportar()).csvListaCorte('corte-avulso', pecas, catalogo.chapas, catalogo.fitas, 1)} disabled={!pecas.length}>
              <FileSpreadsheet className="size-4" /> CSV
            </Botao>
          </div>
        </Painel>

        <Painel className="min-w-0">
          <Abas
            valor={aba}
            onChange={setAba}
            abas={[
              { id: 'corte', label: 'Plano de corte' },
              { id: 'custos', label: 'Custos' },
              { id: 'pecas', label: 'Ajustar peças' },
            ]}
          />
          {aba === 'corte' && <PlanoCorteView plano={plano} pecas={pecas} fitas={catalogo.fitas} calculando={calculando} />}
          {aba === 'custos' && <CustosView custos={custos} venda={config.venda} />}
          {aba === 'pecas' && (
            <TabelaPecas
              pecas={pecas}
              chapas={catalogo.chapas}
              fitas={catalogo.fitas}
              onAlterar={(p) => {
                const i = Number(p.id.split('-')[1]);
                if (p.comprimento !== linhas[i]?.comprimento || p.largura !== linhas[i]?.largura || p.quantidade !== linhas[i]?.quantidade) {
                  // medida mudou: reescreve a linha do texto
                  const novas = s.texto.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
                  novas[i] = `${p.comprimento}x${p.largura}x${p.quantidade}${p.nome && p.nome !== `Peça ${i + 1}` ? ' ' + p.nome : ''}`;
                  setS({ ...s, texto: novas.join('\n') });
                }
                setAjustes({ ...ajustes, [i]: p });
              }}
            />
          )}
        </Painel>
      </div>
    </div>
  );
}
