import { AlertTriangle, FileDown, MessageCircle, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { Custos } from '../costing/calcularCustos';
import { arredondarPreco, precoSugerido, simularVenda } from '../costing/precoSugerido';
import type { ProjetoMontado } from '../domain/composicao';
import { brl, fmtNum } from '../domain/money';
import { itensDoOrcamento, materiaisDoOrcamento } from '../domain/orcamento';
import type { Catalogo, Cliente, Config, Orcamento, Projeto, StatusOrcamento } from '../domain/types';
import { dataValidade, numeroOrcamento } from '../export/orcamentoCliente';
import { rastrear } from '../lib/telemetria';
import { Botao, Campo, DinheiroInput, Interruptor, NumeroInput, Selecao, TextoInput, cx } from './ui';

const STATUS: { valor: StatusOrcamento; label: string; cor: string }[] = [
  { valor: 'rascunho', label: 'Rascunho', cor: 'bg-painel-2 text-tinta-2' },
  { valor: 'enviado', label: 'Enviado', cor: 'bg-aco-claro text-aco' },
  { valor: 'aprovado', label: 'Aprovado', cor: 'bg-[#e3f0e6] text-ok' },
  { valor: 'recusado', label: 'Recusado', cor: 'bg-[#fbeeeb] text-perigo' },
];
export const corStatus = (s?: StatusOrcamento) => STATUS.find((x) => x.valor === s) ?? STATUS[0];

const CLIENTE_VAZIO: Cliente = { nome: '', telefone: '', email: '', endereco: '' };

type Props = {
  projeto: Projeto;
  orcamento: Orcamento;
  montado: ProjetoMontado;
  custos: Custos;
  config: Config;
  catalogo: Catalogo;
  onCliente: (c: Cliente) => void;
  onOrcamento: (o: Orcamento) => void;
  capturarImagem: () => Promise<string | null>;
};

export function OrcamentoView({ projeto, orcamento: o, montado, custos, config, catalogo, onCliente, onOrcamento, capturarImagem }: Props) {
  const cliente = projeto.cliente ?? CLIENTE_VAZIO;
  const [gerando, setGerando] = useState(false);
  const custo = custos.totalLoteCentavos;
  const sugerido = precoSugerido(custo, config.venda);
  const total = o.precoManualCentavos ?? (sugerido !== null ? arredondarPreco(sugerido) : 0);
  const sim = simularVenda(total, custo, config.venda);
  const semEmpresa = !config.empresa.nome.trim();
  const setC = (k: keyof Cliente) => (v: string) => onCliente({ ...cliente, [k]: v });
  const setO = <K extends keyof Orcamento>(k: K, v: Orcamento[K]) => onOrcamento({ ...o, [k]: v });

  const dados = async () => ({
    empresa: config.empresa,
    cliente,
    orcamento: o,
    projeto: projeto.nome,
    imagemPng: await capturarImagem(),
    itens: itensDoOrcamento(projeto, montado, o.detalharItens),
    materiais: materiaisDoOrcamento(montado, catalogo),
    totalCentavos: total,
  });

  const baixar = async () => {
    setGerando(true);
    try {
      const { baixarOrcamento } = await import('../export/orcamentoCliente');
      await baixarOrcamento(await dados());
      rastrear('orcamento_gerado', { totalCentavos: total, margem: Math.round(sim.margemPercent), modulos: montado.modulos.length });
    } finally {
      setGerando(false);
    }
  };

  const fone = cliente.telefone.replace(/\D/g, '');
  const wa = fone.length >= 10 ? `https://wa.me/${fone.length <= 11 ? '55' : ''}${fone}?text=` : 'https://wa.me/?text=';
  const msg = [
    `Olá${cliente.nome ? `, ${cliente.nome.split(' ')[0]}` : ''}! Segue o orçamento nº ${numeroOrcamento(o.numero)} de ${projeto.nome}.`,
    `Valor: ${brl(total)}${o.descontoAVistaPercent > 0 ? ` (à vista ${brl(Math.round(total * (1 - o.descontoAVistaPercent / 100)))})` : ''}.`,
    `Prazo de entrega: ${o.prazoEntregaDias} dias. Válido até ${dataValidade(o)}.`,
    'Te mando o PDF com os detalhes aqui na conversa.',
    config.empresa.nome ? `\n${config.empresa.nome}` : '',
  ].join('\n');

  return (
    <div className="grid gap-6 p-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {semEmpresa && (
          <a href="#/config" className="flex items-center gap-2 rounded-md border border-[#e7c9a6] bg-[#fbf3ea] p-3 text-[13px] text-tinta">
            <AlertTriangle className="size-4 shrink-0 text-mdf-escuro" /> Preencha o nome, o WhatsApp e o logo da marcenaria em Configurações para eles aparecerem no orçamento.
          </a>
        )}

        <section>
          <h3 className="mb-3 font-cond text-[16px] font-semibold">Cliente</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Nome">
              <TextoInput ariaLabel="Nome do cliente" valor={cliente.nome} onChange={setC('nome')} />
            </Campo>
            <Campo label="WhatsApp">
              <TextoInput ariaLabel="WhatsApp do cliente" valor={cliente.telefone} onChange={setC('telefone')} placeholder="(54) 99999-9999" />
            </Campo>
            <Campo label="E-mail">
              <TextoInput ariaLabel="E-mail do cliente" valor={cliente.email} onChange={setC('email')} />
            </Campo>
            <Campo label="Endereço da obra">
              <TextoInput ariaLabel="Endereço da obra" valor={cliente.endereco} onChange={setC('endereco')} />
            </Campo>
          </div>
        </section>

        <section>
          <h3 className="mb-3 font-cond text-[16px] font-semibold">Condições</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo label="Data">
              <input type="date" aria-label="Data do orçamento" className="h-9 w-full rounded-md border border-linha bg-painel px-2.5 outline-none focus:border-aco" value={o.data} onChange={(e) => setO('data', e.target.value)} />
            </Campo>
            <Campo label="Validade" unidade="dias">
              <NumeroInput ariaLabel="Validade em dias" valor={o.validadeDias} min={1} max={365} onChange={(v) => setO('validadeDias', Math.round(v))} />
            </Campo>
            <Campo label="Prazo de entrega" unidade="dias">
              <NumeroInput ariaLabel="Prazo de entrega em dias" valor={o.prazoEntregaDias} min={1} max={365} onChange={(v) => setO('prazoEntregaDias', Math.round(v))} />
            </Campo>
            <div className="sm:col-span-2">
              <Campo label="Forma de pagamento">
                <TextoInput ariaLabel="Forma de pagamento" valor={o.formaPagamento} onChange={(v) => setO('formaPagamento', v)} />
              </Campo>
            </div>
            <Campo label="Desconto à vista" unidade="%">
              <NumeroInput ariaLabel="Desconto à vista" valor={o.descontoAVistaPercent} min={0} max={50} passo={0.5} onChange={(v) => setO('descontoAVistaPercent', v)} />
            </Campo>
            <div className="sm:col-span-3">
              <Campo label="Observações">
                <textarea
                  aria-label="Observações do orçamento"
                  className="min-h-20 w-full rounded-md border border-linha bg-painel p-2.5 outline-none focus:border-aco focus:ring-2 focus:ring-aco-claro"
                  value={o.observacoes}
                  onChange={(e) => setO('observacoes', e.target.value)}
                />
              </Campo>
            </div>
            {montado.modulos.length > 1 && (
              <div className="sm:col-span-3">
                <Interruptor label="Listar cada módulo separado no orçamento" ligado={o.detalharItens} onChange={(v) => setO('detalharItens', v)} />
              </div>
            )}
          </div>
        </section>
      </div>

      <aside className="space-y-4 self-start">
        <div className="rounded-lg border border-linha bg-painel p-4">
          <div className="flex items-center justify-between">
            <span className="font-cond text-[15px] font-semibold">Orçamento nº {numeroOrcamento(o.numero)}</span>
            <Selecao
              ariaLabel="Situação do orçamento"
              className={cx('h-7 w-auto border-0 text-[12px] font-medium', corStatus(o.status).cor)}
              valor={o.status}
              onChange={(v) => {
                setO('status', v as StatusOrcamento);
                rastrear('orcamento_status', { status: v });
              }}
              opcoes={STATUS.map((s) => ({ valor: s.valor, label: s.label }))}
            />
          </div>

          <div className="mt-4 text-[13px] text-tinta-3">Valor para o cliente</div>
          <DinheiroInput ariaLabel="Valor do orçamento" centavos={total} onChange={(v) => setO('precoManualCentavos', v)} />
          <div className="mt-1 flex flex-wrap gap-x-3 text-[12px]">
            {o.precoManualCentavos !== null && sugerido !== null && (
              <button className="inline-flex items-center gap-1 text-aco hover:underline" onClick={() => setO('precoManualCentavos', null)}>
                <RotateCcw className="size-3" /> voltar ao sugerido ({brl(arredondarPreco(sugerido))})
              </button>
            )}
            {o.descontoAVistaPercent > 0 && <span className="text-tinta-3 num">à vista {brl(Math.round(total * (1 - o.descontoAVistaPercent / 100)))}</span>}
          </div>

          <dl className="mt-4 space-y-1 border-t border-linha pt-3 text-[13px] num">
            <div className="flex justify-between">
              <dt className="text-tinta-2">Custo de produção</dt>
              <dd>{brl(custo)}</dd>
            </div>
            {[
              ['Imposto', sim.impostoCentavos],
              ['Comissão', sim.comissaoCentavos],
              ['Taxa do cartão', sim.cartaoCentavos],
            ]
              .filter(([, v]) => (v as number) > 0)
              .map(([k, v]) => (
                <div key={k as string} className="flex justify-between">
                  <dt className="text-tinta-2">{k}</dt>
                  <dd>{brl(v as number)}</dd>
                </div>
              ))}
            <div className="flex justify-between border-t border-linha pt-2 font-medium">
              <dt>Lucro</dt>
              <dd className={sim.lucroCentavos < 0 ? 'text-perigo' : 'text-ok'}>
                {brl(sim.lucroCentavos)} <span className="font-normal text-tinta-3">({fmtNum(sim.margemPercent, 0)}%)</span>
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-tinta-3">Custo e lucro são só para você. O PDF do cliente mostra apenas o valor.</p>
        </div>

        <div className="grid gap-2">
          <Botao variante="primario" onClick={baixar} disabled={gerando}>
            <FileDown className="size-4" /> {gerando ? 'Gerando…' : 'Baixar orçamento (PDF)'}
          </Botao>
          <a
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-linha bg-painel px-3.5 font-medium text-tinta hover:bg-painel-2"
            href={wa + encodeURIComponent(msg)}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              rastrear('orcamento_whatsapp');
              if (o.status === 'rascunho') setO('status', 'enviado');
            }}
          >
            <MessageCircle className="size-4" /> Mandar resumo no WhatsApp
          </a>
          <p className="text-[11px] text-tinta-3">O WhatsApp abre com a mensagem pronta; anexe o PDF baixado na conversa.</p>
        </div>
      </aside>
    </div>
  );
}
