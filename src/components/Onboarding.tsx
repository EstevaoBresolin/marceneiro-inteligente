import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { novoId } from '../domain/money';
import type { CorteModo } from '../domain/types';
import { rastrear } from '../lib/telemetria';
import { ir } from '../lib/router';
import { useApp } from '../store/app';
import { templatePorId } from '../templates';
import { FormEmpresa, FormFolgas, FormPreco } from './FormsConfig';
import { Botao, Campo, DinheiroInput, NumeroInput, Selecao, TextoInput, cx } from './ui';

const PASSOS = ['Sua marcenaria', 'Chapas e preços', 'Folgas e lucro', 'Primeiro móvel'];
const SUGESTOES = ['armario-portas', 'balcao', 'aereo-cozinha', 'gaveteiro', 'nicho', 'estante'];

export function Onboarding() {
  const { config, setConfig, catalogo, setCatalogo, novoProjeto } = useApp();
  const [passo, setPasso] = useState(0);
  const s = config.servico;

  const concluir = (templateId?: string) => {
    setConfig((c) => void (c.onboardingConcluido = true));
    rastrear('onboarding_concluido', { passo, modelo: templateId ?? null });
    if (templateId) {
      const p = novoProjeto(templateId);
      ir(`/editor/${p.id}`);
    }
  };

  const podeAvancar = passo !== 0 || config.empresa.nome.trim().length > 1;

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-fundo">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col p-4 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <span className="font-cond text-[17px] font-semibold">Marceneiro Inteligente</span>
          <button className="text-[13px] text-tinta-3 hover:text-tinta" onClick={() => concluir()}>
            Pular por agora
          </button>
        </div>

        <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Etapas">
          {PASSOS.map((t, i) => (
            <li key={t} aria-current={i === passo ? 'step' : undefined}>
              <div className={cx('h-1 rounded-full', i <= passo ? 'bg-mdf' : 'bg-linha')} />
              <div className={cx('mt-1.5 hidden text-[12px] sm:block', i === passo ? 'font-medium text-tinta' : 'text-tinta-3')}>
                {i + 1}. {t}
              </div>
            </li>
          ))}
        </ol>

        <div className="flex-1 rounded-xl border border-linha bg-painel p-5 sm:p-7">
          {passo === 0 && (
            <>
              <h1 className="font-cond text-2xl font-semibold">Bem-vindo! Vamos deixar o sistema com a cara da sua marcenaria.</h1>
              <p className="mb-6 mt-1 text-tinta-2">Leva uns 3 minutos. Esses dados aparecem nos orçamentos que você mandar para os clientes.</p>
              <FormEmpresa empresa={config.empresa} setConfig={setConfig} compacto />
            </>
          )}

          {passo === 1 && (
            <>
              <h1 className="font-cond text-2xl font-semibold">Quanto você paga no material?</h1>
              <p className="mb-5 mt-1 text-tinta-2">Os valores abaixo são exemplos. Troque pelos do seu fornecedor para o custo e o plano de corte saírem certos.</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-[13px]">
                  <thead>
                    <tr className="text-left text-tinta-3">
                      <th className="pb-2 font-medium">Chapa</th>
                      <th className="pb-2 font-medium">Esp. (mm)</th>
                      <th className="pb-2 font-medium">Tamanho (mm)</th>
                      <th className="pb-2 font-medium">Preço da chapa</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {catalogo.chapas.map((ch, i) => (
                      <tr key={ch.id}>
                        <td className="py-1 pr-2">
                          <TextoInput ariaLabel="Nome da chapa" className="h-8" valor={ch.nome} onChange={(v) => setCatalogo((c) => void (c.chapas[i].nome = v))} />
                        </td>
                        <td className="w-20 py-1 pr-2">
                          <NumeroInput ariaLabel="Espessura" className="h-8" valor={ch.espessura} min={1} onChange={(v) => setCatalogo((c) => void (c.chapas[i].espessura = v))} />
                        </td>
                        <td className="w-48 py-1 pr-2">
                          <div className="flex items-center gap-1">
                            <NumeroInput ariaLabel="Comprimento da chapa" className="h-8" valor={ch.largura} min={100} onChange={(v) => setCatalogo((c) => void (c.chapas[i].largura = Math.round(v)))} />
                            <span className="text-tinta-3">×</span>
                            <NumeroInput ariaLabel="Largura da chapa" className="h-8" valor={ch.altura} min={100} onChange={(v) => setCatalogo((c) => void (c.chapas[i].altura = Math.round(v)))} />
                          </div>
                        </td>
                        <td className="w-36 py-1 pr-2">
                          <DinheiroInput ariaLabel="Preço da chapa" centavos={ch.precoCentavos} onChange={(v) => setCatalogo((c) => void (c.chapas[i].precoCentavos = v))} />
                        </td>
                        <td className="py-1">
                          <button aria-label={`Remover ${ch.nome}`} className="text-tinta-3 hover:text-perigo" onClick={() => setCatalogo((c) => void c.chapas.splice(i, 1))}>
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="mt-2 flex items-center gap-1 text-[13px] font-medium text-aco hover:underline"
                onClick={() => setCatalogo((c) => void c.chapas.push({ id: novoId(), nome: 'MDF ', espessura: 15, largura: 2750, altura: 1850, temVeio: false, precoCentavos: 0, cor: '#f1efe9' }))}
              >
                <Plus className="size-4" /> Adicionar chapa
              </button>

              <div className="mt-6 grid gap-4 border-t border-linha pt-5 sm:grid-cols-3">
                {catalogo.fitas[0] && (
                  <Campo label={`${catalogo.fitas[0].nome}`} unidade="por metro">
                    <DinheiroInput ariaLabel="Preço da fita por metro" centavos={catalogo.fitas[0].precoMetroCentavos} onChange={(v) => setCatalogo((c) => void (c.fitas[0].precoMetroCentavos = v))} />
                  </Campo>
                )}
                <Campo label="Como o corte é cobrado">
                  <Selecao
                    ariaLabel="Modo de cobrança do corte"
                    valor={s.corteModo}
                    onChange={(x) => setConfig((c) => void (c.servico.corteModo = x as CorteModo))}
                    opcoes={[
                      { valor: 'incluso', label: 'Corto aqui / incluso' },
                      { valor: 'por_peca', label: 'Por peça cortada' },
                      { valor: 'por_metro_linear', label: 'Por metro de corte' },
                      { valor: 'por_chapa', label: 'Por chapa' },
                    ]}
                  />
                </Campo>
                {s.corteModo !== 'incluso' && (
                  <Campo label="Preço do corte">
                    <DinheiroInput ariaLabel="Preço do corte" centavos={s.cortePrecoCentavos} onChange={(x) => setConfig((c) => void (c.servico.cortePrecoCentavos = x))} />
                  </Campo>
                )}
                <Campo label="Valor da sua hora" dica="Para a mão de obra de montagem.">
                  <DinheiroInput ariaLabel="Valor da hora" centavos={s.maoDeObraHoraCentavos} onChange={(x) => setConfig((c) => void (c.servico.maoDeObraHoraCentavos = x))} />
                </Campo>
              </div>
              <p className="mt-4 text-[12px] text-tinta-3">Fitas, ferragens e outros preços ficam em Catálogo e Configurações, quando quiser ajustar.</p>
            </>
          )}

          {passo === 2 && (
            <>
              <h1 className="font-cond text-2xl font-semibold">Do seu jeito de fabricar</h1>
              <p className="mb-5 mt-1 text-tinta-2">As medidas das peças e os desenhos saem com essas folgas.</p>
              <FormFolgas config={config} setConfig={setConfig} />
              <h2 className="mb-3 mt-8 font-cond text-lg font-semibold">E quanto você quer ganhar?</h2>
              <FormPreco config={config} setConfig={setConfig} />
            </>
          )}

          {passo === 3 && (
            <>
              <h1 className="font-cond text-2xl font-semibold">Pronto. Qual móvel você quer orçar primeiro?</h1>
              <p className="mb-5 mt-1 text-tinta-2">Você digita as medidas e o sistema gera as peças, o 3D, o plano de corte e o orçamento.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SUGESTOES.map((id) => {
                  const t = templatePorId(id);
                  return (
                    <button key={id} onClick={() => concluir(id)} className="rounded-lg border border-linha p-4 text-left transition-colors hover:border-aco hover:bg-aco-claro/30">
                      <div className="font-cond text-[16px] font-semibold">{t.nome}</div>
                      <div className="mt-1 text-[13px] text-tinta-3">{t.descricao}</div>
                    </button>
                  );
                })}
              </div>
              <button className="mt-4 text-[13px] font-medium text-aco hover:underline" onClick={() => concluir()}>
                Ver todos os modelos
              </button>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <Botao variante="fantasma" onClick={() => setPasso((p) => p - 1)} disabled={passo === 0}>
            <ArrowLeft className="size-4" /> Voltar
          </Botao>
          {passo < 3 && (
            <Botao
              variante="primario"
              disabled={!podeAvancar}
              onClick={() => {
                rastrear('onboarding_passo', { passo: passo + 1 });
                setPasso((p) => p + 1);
              }}
            >
              Continuar <ArrowRight className="size-4" />
            </Botao>
          )}
        </div>
        {!podeAvancar && <p className="mt-2 text-right text-[12px] text-tinta-3">Coloque o nome da marcenaria para continuar.</p>}
      </div>
    </div>
  );
}
