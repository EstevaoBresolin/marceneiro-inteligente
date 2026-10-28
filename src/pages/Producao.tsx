import { FileDown, FileSpreadsheet, Scissors } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ExportarMaquina } from '../components/ExportarMaquina';
import { corStatus } from '../components/OrcamentoView';
import { Botao, NumeroInput, Painel, Titulo, cx } from '../components/ui';
import { PlanoCorteView } from '../cutplan/PlanoCorteView';
import { brl, fmtNum } from '../domain/money';
import { pecasDaProducao, type ItemProducao } from '../domain/producao';
import type { PlanoCorte } from '../optimizer';
import { rastrear } from '../lib/telemetria';
import { usePlanosCorte } from '../lib/usePlanoCorte';
import { useApp } from '../store/app';

const CHAVE = 'mi-producao';

const totalChapas = (p?: PlanoCorte) => (p ? p.grupos.reduce((s, g) => s + g.chapas.length, 0) : 0);
const custoChapas = (p?: PlanoCorte) => (p ? p.grupos.reduce((s, g) => s + g.chapas.length * (g.chapa.precoCentavos ?? 0), 0) : 0);

export function Producao() {
  const { projetos, catalogo, config, setConfig } = useApp();
  const [verCsv, setVerCsv] = useState(false);
  const ctx = useMemo(() => ({ catalogo, config }), [catalogo, config]);
  const [sel, setSel] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(CHAVE) ?? '{}');
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(sel));
    } catch {
      /* ignora */
    }
  }, [sel]);

  const comPecas = projetos.filter((p) => p.templateId !== 'livre' || p.pecas.length);
  const itens: ItemProducao[] = useMemo(
    () => comPecas.filter((p) => (sel[p.id] ?? 0) > 0).map((p) => ({ projeto: p, quantidade: sel[p.id] })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projetos, sel],
  );
  const pecas = useMemo(() => pecasDaProducao(itens, ctx), [itens, ctx]);
  // primeiro pedido = tudo junto; depois, cada projeto separado (para mostrar a economia)
  const pedidos = useMemo(() => [{ pecas, lote: 1 }, ...itens.map((it) => ({ pecas: pecasDaProducao([it], ctx), lote: 1 }))], [pecas, itens, ctx]);
  const { planos, calculando } = usePlanosCorte(itens.length ? pedidos : [], catalogo.chapas, config.servico.kerf, config.servico.refilo, 3000);
  const junto = planos[0];
  const separados = planos.slice(1);
  const chapasJunto = totalChapas(junto);
  const chapasSeparado = separados.reduce((s, p) => s + totalChapas(p), 0);
  const economia = separados.reduce((s, p) => s + custoChapas(p), 0) - custoChapas(junto);

  const marcar = (id: string, qtd: number) => setSel((s) => ({ ...s, [id]: Math.max(0, qtd) }));
  const nome = `Corte ${new Date().toLocaleDateString('pt-BR')} (${itens.length} projeto${itens.length === 1 ? '' : 's'})`;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8">
      <Titulo sub="Marque os projetos que vão para a serra juntos. As peças de todos dividem as mesmas chapas.">Corte da semana</Titulo>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Painel className="self-start">
          <div className="flex items-center justify-between border-b border-linha px-4 py-3">
            <span className="text-[13px] font-medium">{comPecas.length} projetos</span>
            <div className="flex gap-3 text-[12px]">
              <button className="text-aco hover:underline" onClick={() => setSel(Object.fromEntries(comPecas.filter((p) => p.orcamento?.status === 'aprovado').map((p) => [p.id, p.quantidadeLote || 1])))}>
                Só aprovados
              </button>
              <button className="text-tinta-3 hover:text-tinta" onClick={() => setSel({})}>
                Limpar
              </button>
            </div>
          </div>
          <ul className="max-h-[60vh] divide-y divide-linha overflow-y-auto">
            {comPecas.map((p) => {
              const q = sel[p.id] ?? 0;
              const st = p.orcamento ? corStatus(p.orcamento.status) : null;
              return (
                <li key={p.id} className={cx('flex items-center gap-3 px-4 py-2.5', q > 0 && 'bg-aco-claro/50')}>
                  <input type="checkbox" aria-label={`Incluir ${p.nome}`} className="size-4 accent-aco" checked={q > 0} onChange={(e) => marcar(p.id, e.target.checked ? p.quantidadeLote || 1 : 0)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{p.nome}</div>
                    <div className="flex items-center gap-1.5 text-[12px] text-tinta-3">
                      {p.cliente?.nome && <span className="truncate">{p.cliente.nome}</span>}
                      {st && <span className={cx('rounded px-1 text-[10px] font-medium', st.cor)}>{st.label}</span>}
                    </div>
                  </div>
                  {q > 0 && (
                    <div className="w-16">
                      <NumeroInput ariaLabel={`Quantidade de ${p.nome}`} className="h-8" valor={q} min={0} max={500} onChange={(v) => marcar(p.id, Math.round(v))} />
                    </div>
                  )}
                </li>
              );
            })}
            {!comPecas.length && <li className="p-4 text-[13px] text-tinta-3">Crie projetos primeiro; eles aparecem aqui.</li>}
          </ul>
        </Painel>

        <div className="min-w-0 space-y-4">
          {!itens.length ? (
            <Painel className="grid place-items-center p-10 text-center text-tinta-2">
              <Scissors className="mb-2 size-8 text-tinta-3" />
              Marque dois ou mais projetos ao lado para ver quantas chapas você economiza cortando tudo junto.
            </Painel>
          ) : (
            <>
              <Painel className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
                <div>
                  <div className="text-[12px] text-tinta-3">Cortando tudo junto</div>
                  <div className="font-cond text-3xl font-semibold num">{calculando && !junto ? '…' : `${chapasJunto} chapa${chapasJunto === 1 ? '' : 's'}`}</div>
                </div>
                {itens.length > 1 && (
                  <>
                    <div>
                      <div className="text-[12px] text-tinta-3">Cada projeto separado</div>
                      <div className="font-cond text-3xl font-semibold text-tinta-3 num">{chapasSeparado || '…'} chapas</div>
                    </div>
                    {separados.length === itens.length && (
                      <div className="rounded-md bg-[#e3f0e6] px-3 py-2 text-ok">
                        <div className="text-[12px]">Economia</div>
                        <div className="font-cond text-2xl font-semibold num">
                          {chapasSeparado - chapasJunto} chapa{chapasSeparado - chapasJunto === 1 ? '' : 's'} · {brl(Math.max(0, economia))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="ml-auto flex gap-2">
                  <Botao
                    disabled={!junto || calculando}
                    onClick={async () => {
                      rastrear('exportou', { tipo: 'corte_semana', projetos: itens.length });
                      const { pdfPlanoCorte } = await import('../export/exportar');
                      await pdfPlanoCorte({ projeto: nome, plano: junto, pecas, fitas: catalogo.fitas, lote: 1 });
                    }}
                  >
                    <FileDown className="size-4" /> PDF
                  </Botao>
                  <Botao disabled={!pecas.length} variante={verCsv ? 'primario' : 'secundario'} onClick={() => setVerCsv((v) => !v)}>
                    <FileSpreadsheet className="size-4" /> Seccionadora (CSV)
                  </Botao>
                </div>
              </Painel>
              {verCsv && (
                <Painel className="p-4">
                  <ExportarMaquina pecas={pecas} lote={1} nome={nome} catalogo={catalogo} config={config} setConfig={setConfig} comDxf={false} />
                </Painel>
              )}
              <p className="text-[12px] text-tinta-3">
                {fmtNum(pecas.reduce((s, p) => s + p.quantidade, 0), 0)} peças de {itens.length} projeto(s). O nome de cada peça começa pelo cliente (ou projeto), para separar depois do corte.
              </p>
              <Painel>{junto ? <PlanoCorteView plano={junto} pecas={pecas} fitas={catalogo.fitas} calculando={calculando} /> : <p className="p-6 text-tinta-3">Calculando…</p>}</Painel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
