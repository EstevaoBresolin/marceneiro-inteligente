import { useState } from 'react';
import { Botao, Campo, DinheiroInput, NumeroInput, Painel, Segmentos, Selecao, Titulo } from '../components/ui';
import { NOMES_FURO, type CorteModo, type TipoFuro } from '../domain/types';
import { useApp } from '../store/app';

function Secao({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <Painel className="mb-6 p-5">
      <h2 className="font-cond text-lg font-semibold">{titulo}</h2>
      {sub && <p className="mb-4 text-[13px] text-tinta-3">{sub}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </Painel>
  );
}

const ROTULO_CORTE: Record<CorteModo, string> = {
  por_peca: 'Preço por peça',
  por_metro_linear: 'Preço por metro de corte',
  por_chapa: 'Preço por chapa',
  incluso: 'Preço',
};

export function Config() {
  const { config, setConfig, restaurarPadroes } = useApp();
  const s = config.servico;
  const v = config.venda;
  const [confirmar, setConfirmar] = useState(false);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <Titulo sub="Como o seu fornecedor cobra e quanto o marketplace fica de cada venda.">Configurações</Titulo>

      <Secao titulo="Corte" sub="Serra e refilo afetam o plano de corte; o preço entra no custo.">
        <Campo label="Como o corte é cobrado">
          <Selecao
            ariaLabel="Modo de cobrança do corte"
            valor={s.corteModo}
            onChange={(x) => setConfig((c) => void (c.servico.corteModo = x as CorteModo))}
            opcoes={[
              { valor: 'por_peca', label: 'Por peça cortada' },
              { valor: 'por_metro_linear', label: 'Por metro linear de corte' },
              { valor: 'por_chapa', label: 'Por chapa' },
              { valor: 'incluso', label: 'Incluso no preço da chapa' },
            ]}
          />
        </Campo>
        {s.corteModo !== 'incluso' && (
          <Campo label={ROTULO_CORTE[s.corteModo]}>
            <DinheiroInput ariaLabel={ROTULO_CORTE[s.corteModo]} centavos={s.cortePrecoCentavos} onChange={(x) => setConfig((c) => void (c.servico.cortePrecoCentavos = x))} />
          </Campo>
        )}
        <div />
        <Campo label="Espessura da serra (kerf)" unidade="mm" dica="Material perdido em cada corte.">
          <NumeroInput ariaLabel="Kerf" valor={s.kerf} min={0} max={10} passo={0.5} onChange={(x) => setConfig((c) => void (c.servico.kerf = x))} />
        </Campo>
        <Campo label="Refilo" unidade="mm" dica="Margem descartada em cada borda da chapa.">
          <NumeroInput ariaLabel="Refilo" valor={s.refilo} min={0} max={50} onChange={(x) => setConfig((c) => void (c.servico.refilo = x))} />
        </Campo>
      </Secao>

      <Secao titulo="Chapa" sub="Como o custo da chapa entra no preço do móvel.">
        <Campo label="Cobrar no custo">
          <Segmentos
            valor={s.chapaCobranca}
            onChange={(x) => setConfig((c) => void (c.servico.chapaCobranca = x as 'inteiras' | 'proporcional'))}
            opcoes={[
              { valor: 'proporcional', label: 'Área usada' },
              { valor: 'inteiras', label: 'Chapas inteiras' },
            ]}
          />
        </Campo>
        {s.chapaCobranca === 'proporcional' && (
          <Campo label="Perda sobre a área" unidade="%" dica="Cobre serra, refilo e sobras que não voltam a ser usadas.">
            <NumeroInput ariaLabel="Perda da chapa" valor={s.perdaChapaPercent} min={0} max={100} onChange={(x) => setConfig((c) => void (c.servico.perdaChapaPercent = x))} />
          </Campo>
        )}
        <Campo label="Espelho 4mm" unidade="por m²">
          <DinheiroInput ariaLabel="Preço do espelho por m²" centavos={s.espelhoM2Centavos} onChange={(x) => setConfig((c) => void (c.servico.espelhoM2Centavos = x))} />
        </Campo>
      </Secao>

      <Secao titulo="Fita de borda">
        <Campo label="Perda" unidade="%" dica="Sobra nas pontas e erros de aplicação.">
          <NumeroInput ariaLabel="Perda da fita" valor={s.perdaFitaPercent} min={0} max={100} onChange={(x) => setConfig((c) => void (c.servico.perdaFitaPercent = x))} />
        </Campo>
        <Campo label="Aplicação (coladeira)" unidade="por metro" dica="Deixe R$ 0 se você mesmo aplica.">
          <DinheiroInput ariaLabel="Aplicação da fita" centavos={s.coladeiraPrecoMetroCentavos} onChange={(x) => setConfig((c) => void (c.servico.coladeiraPrecoMetroCentavos = x))} />
        </Campo>
      </Secao>

      <Secao titulo="Furação" sub="Preço por furo cobrado pelo fornecedor. R$ 0 se você mesmo fura.">
        {(Object.keys(NOMES_FURO) as TipoFuro[]).map((k) => (
          <Campo key={k} label={NOMES_FURO[k]}>
            <DinheiroInput ariaLabel={NOMES_FURO[k]} centavos={s.furoPrecos[k]} onChange={(x) => setConfig((c) => void (c.servico.furoPrecos[k] = x))} />
          </Campo>
        ))}
      </Secao>

      <Secao titulo="Mão de obra">
        <Campo label="Valor da hora">
          <DinheiroInput ariaLabel="Valor da hora" centavos={s.maoDeObraHoraCentavos} onChange={(x) => setConfig((c) => void (c.servico.maoDeObraHoraCentavos = x))} />
        </Campo>
      </Secao>

      <Secao titulo="Venda no marketplace" sub="Use os valores do seu tipo de anúncio no Mercado Livre. O preço sugerido é calculado para sobrar a margem desejada depois de todas as taxas.">
        <Campo label="Comissão" unidade="% do preço">
          <NumeroInput ariaLabel="Comissão" valor={v.comissaoMarketplacePercent} min={0} max={99} passo={0.5} onChange={(x) => setConfig((c) => void (c.venda.comissaoMarketplacePercent = x))} />
        </Campo>
        <Campo label="Taxa fixa por venda">
          <DinheiroInput ariaLabel="Taxa fixa" centavos={v.taxaFixaCentavos} onChange={(x) => setConfig((c) => void (c.venda.taxaFixaCentavos = x))} />
        </Campo>
        <Campo label="Frete pago por você">
          <DinheiroInput ariaLabel="Frete" centavos={v.freteCentavos} onChange={(x) => setConfig((c) => void (c.venda.freteCentavos = x))} />
        </Campo>
        <Campo label="Imposto" unidade="% do preço">
          <NumeroInput ariaLabel="Imposto" valor={v.impostoPercent} min={0} max={99} passo={0.5} onChange={(x) => setConfig((c) => void (c.venda.impostoPercent = x))} />
        </Campo>
        <Campo label="Margem desejada" unidade="% do preço">
          <NumeroInput ariaLabel="Margem" valor={v.margemDesejadaPercent} min={0} max={99} onChange={(x) => setConfig((c) => void (c.venda.margemDesejadaPercent = x))} />
        </Campo>
      </Secao>

      <div className="flex items-center gap-3">
        {confirmar ? (
          <>
            <Botao variante="perigo" onClick={() => (restaurarPadroes(), setConfirmar(false))}>
              Sim, voltar catálogo e configurações aos valores de exemplo
            </Botao>
            <Botao variante="fantasma" onClick={() => setConfirmar(false)}>
              Cancelar
            </Botao>
          </>
        ) : (
          <Botao variante="fantasma" onClick={() => setConfirmar(true)}>
            Restaurar valores de exemplo
          </Botao>
        )}
      </div>
    </div>
  );
}
