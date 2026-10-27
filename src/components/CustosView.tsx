import { useState } from 'react';
import { GRUPOS, type Custos, type GrupoCusto } from '../costing/calcularCustos';
import { precoSugerido, simularVenda } from '../costing/precoSugerido';
import { brl, fmtNum } from '../domain/money';
import type { ConfigVenda } from '../domain/types';
import { DinheiroInput, cx } from './ui';

export const COR_GRUPO: Record<GrupoCusto, string> = {
  Chapa: '#b5895a',
  'Fita de borda': '#d9b77e',
  Corte: '#6f8a9a',
  Furação: '#9fb4c0',
  Ferragens: '#2f5d7c',
  Extras: '#8fae95',
  'Mão de obra': '#59646a',
};

export function CustosView({ custos, venda }: { custos: Custos; venda: ConfigVenda }) {
  const [porUnidade, setPorUnidade] = useState(true);
  const [aberto, setAberto] = useState<GrupoCusto | null>(null);
  const div = porUnidade ? custos.lote : 1;
  const unit = custos.unitarioCentavos;
  const sugerido = precoSugerido(unit, venda);
  const [precoSim, setPrecoSim] = useState<number | null>(null);
  const sim = simularVenda(precoSim ?? sugerido ?? 0, unit, venda);
  const total = custos.totalLoteCentavos || 1;
  const grupos = GRUPOS.filter((g) => custos.porGrupo[g] > 0);

  return (
    <div className="grid gap-6 p-4 xl:grid-cols-[1fr_340px]">
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="text-[13px] text-tinta-3">{porUnidade ? 'Custo por unidade' : `Custo do lote (${custos.lote} un.)`}</div>
            <div className="font-cond text-4xl font-semibold num">{brl(Math.round(custos.totalLoteCentavos / div))}</div>
          </div>
          {custos.lote > 1 && (
            <button className="text-[13px] text-aco hover:underline" onClick={() => setPorUnidade(!porUnidade)}>
              Ver {porUnidade ? 'lote inteiro' : 'por unidade'}
            </button>
          )}
        </div>

        {/* composição */}
        <div className="mt-4 flex h-7 overflow-hidden rounded-md" role="img" aria-label="Composição do custo">
          {grupos.map((g) => (
            <div key={g} title={`${g}: ${brl(Math.round(custos.porGrupo[g] / div))}`} style={{ width: `${(custos.porGrupo[g] / total) * 100}%`, background: COR_GRUPO[g] }} />
          ))}
        </div>

        <ul className="mt-4 divide-y divide-linha rounded-lg border border-linha bg-painel">
          {grupos.map((g) => {
            const linhas = custos.linhas.filter((l) => l.grupo === g);
            return (
              <li key={g}>
                <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-painel-2" onClick={() => setAberto(aberto === g ? null : g)} aria-expanded={aberto === g}>
                  <span className="size-3 rounded-sm" style={{ background: COR_GRUPO[g] }} />
                  <span className="flex-1 font-medium">{g}</span>
                  <span className="text-tinta-3 text-[13px] num">{fmtNum((custos.porGrupo[g] / total) * 100, 0)}%</span>
                  <span className="w-28 text-right num font-medium">{brl(Math.round(custos.porGrupo[g] / div))}</span>
                </button>
                {aberto === g && (
                  <ul className="bg-painel-2 px-3 pb-2 text-[13px]">
                    {linhas.map((l, i) => (
                      <li key={i} className="flex gap-3 py-1.5 border-t border-linha first:border-0">
                        <div className="flex-1">
                          <div>{l.descricao}</div>
                          <div className="text-tinta-3 text-[12px] num">{l.conta}{porUnidade && custos.lote > 1 ? ` ÷ ${custos.lote} un.` : ''}</div>
                        </div>
                        <span className="num">{brl(Math.round(l.totalCentavos / div))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          {grupos.length === 0 && <li className="p-3 text-tinta-3">Sem custos ainda.</li>}
        </ul>
        {custos.metrosFita > 0 && (
          <p className="mt-2 text-[13px] text-tinta-3 num">
            Fita de borda: {fmtNum(custos.metrosFita / custos.lote)} m por unidade (sem perda). Chapas no lote: {custos.chapasUsadas.map((c) => `${c.quantidade}× ${c.nome}`).join(', ')}.
          </p>
        )}
      </div>

      <aside className="rounded-lg border border-linha bg-painel p-4 self-start">
        <div className="text-[13px] text-tinta-3">Preço sugerido para {fmtNum(venda.margemDesejadaPercent, 0)}% de margem</div>
        <div className="font-cond text-4xl font-semibold text-aco num">{sugerido === null ? '—' : brl(sugerido)}</div>
        {sugerido === null && <p className="text-[13px] text-perigo mt-1">Comissão + imposto + margem passam de 100%. Ajuste em Configurações.</p>}

        <div className="mt-5 border-t border-linha pt-4">
          <div className="mb-1 text-[13px] text-tinta-2">Se eu vender por</div>
          <DinheiroInput ariaLabel="Preço de venda para simular" centavos={precoSim ?? sugerido ?? 0} onChange={setPrecoSim} />
          <dl className="mt-3 space-y-1 text-[13px] num">
            {[
              ['Comissão do marketplace', -sim.comissaoCentavos],
              ['Imposto', -sim.impostoCentavos],
              ['Taxa fixa', -sim.taxaFixaCentavos],
              ['Frete', -sim.freteCentavos],
              ['Custo de produção', -sim.custoCentavos],
            ]
              .filter(([, v]) => v !== 0)
              .map(([k, v]) => (
                <div key={k as string} className="flex justify-between">
                  <dt className="text-tinta-2">{k}</dt>
                  <dd>{brl(v as number)}</dd>
                </div>
              ))}
            <div className="flex justify-between border-t border-linha pt-2 font-medium">
              <dt>Lucro líquido</dt>
              <dd className={cx(sim.lucroCentavos < 0 ? 'text-perigo' : 'text-ok')}>
                {brl(sim.lucroCentavos)} <span className="font-normal text-tinta-3">({fmtNum(sim.margemPercent, 1)}%)</span>
              </dd>
            </div>
          </dl>
          {precoSim !== null && (
            <button className="mt-2 text-[13px] text-aco hover:underline" onClick={() => setPrecoSim(null)}>
              Voltar ao preço sugerido
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
