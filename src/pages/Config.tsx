import { useState } from 'react';
import { Botao, Campo, DinheiroInput, Interruptor, NumeroInput, Painel, Segmentos, Selecao, Titulo } from '../components/ui';
import { NOMES_FURO, type CorteModo, type TipoFuro } from '../domain/types';
import { useApp } from '../store/app';
import { PainelBackup } from '../components/Backup';
import { FormEmpresa, FormFolgas, FormPadroesOrcamento, FormPreco, FormUsinagem } from '../components/FormsConfig';
import { USINAGEM_PADRAO } from '../domain/usinagem';

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
  const [confirmar, setConfirmar] = useState(false);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <Titulo sub="Dados da marcenaria, como o fornecedor cobra e como você forma o preço.">Configurações</Titulo>

      <Painel className="mb-6 p-5">
        <h2 className="mb-4 font-cond text-lg font-semibold">Sua marcenaria</h2>
        <FormEmpresa empresa={config.empresa} setConfig={setConfig} />
      </Painel>

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

      <Painel className="mb-6 p-5">
        <h2 className="font-cond text-lg font-semibold">Preço para o cliente</h2>
        <p className="mb-4 text-[13px] text-tinta-3">O preço sugerido de cada projeto é calculado para sobrar o lucro desejado depois do custo, do imposto e das taxas.</p>
        <FormPreco config={config} setConfig={setConfig} />
      </Painel>

      <Painel className="mb-6 p-5">
        <h2 className="font-cond text-lg font-semibold">Padrões do orçamento</h2>
        <p className="mb-4 text-[13px] text-tinta-3">Vêm preenchidos em cada orçamento novo. Dá para mudar em cada projeto.</p>
        <FormPadroesOrcamento config={config} setConfig={setConfig} />
      </Painel>

      <Painel className="mb-6 p-5">
        <h2 className="font-cond text-lg font-semibold">Folgas e serra</h2>
        <p className="mb-4 text-[13px] text-tinta-3">As folgas valem para os módulos que você criar daqui para frente.</p>
        <FormFolgas config={config} setConfig={setConfig} />
      </Painel>

      <Painel className="mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-cond text-lg font-semibold">Furação</h2>
            <p className="mb-4 text-[13px] text-tinta-3">Os desenhos das peças e o DXF para CNC usam estas medidas. Coloque as da sua furadeira ou gabarito.</p>
          </div>
          <Botao tamanho="sm" variante="fantasma" onClick={() => setConfig((c) => void (c.usinagem = structuredClone(USINAGEM_PADRAO)))}>
            Voltar ao padrão
          </Botao>
        </div>
        <FormUsinagem config={config} setConfig={setConfig} />
      </Painel>

      <Painel id="backup" className="mb-6 p-5">
        <h2 className="font-cond text-lg font-semibold">Backup</h2>
        <p className="mb-4 text-[13px] text-tinta-3">Seus projetos ficam só neste navegador. Baixe um backup toda semana e guarde o arquivo (no e-mail, no Drive ou num pendrive).</p>
        <PainelBackup />
      </Painel>

      <Painel className="mb-6 p-5">
        <h2 className="font-cond text-lg font-semibold">Privacidade</h2>
        <p className="mb-3 text-[13px] text-tinta-3">
          Durante o teste o sistema manda registros simples de uso (sem medidas, valores ou dados de clientes). <a href="#/termos" className="text-aco hover:underline">Ler os termos</a>
        </p>
        <Interruptor label="Enviar registros de uso para ajudar a melhorar o sistema" ligado={config.enviarUso !== false} onChange={(v) => setConfig((c) => void (c.enviarUso = v))} />
      </Painel>

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
