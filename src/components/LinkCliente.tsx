import { Check, Copy, Eye, Link2, MessageCircle, RefreshCw, ThumbsUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ProjetoMontado } from '../domain/composicao';
import type { Catalogo, Config, Projeto } from '../domain/types';
import { dataValidade } from '../export/orcamentoCliente';
import { desativarLink, montarDadosLink, publicarLink, statusDoLink, urlDoLink, type StatusLink } from '../lib/compartilhar';
import { nuvemAtiva, useNuvem } from '../lib/nuvem';
import { rastrear } from '../lib/telemetria';
import { Botao, Interruptor } from './ui';

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

type Props = { projeto: Projeto; montado: ProjetoMontado; catalogo: Catalogo; config: Config; valorCentavos: number; onAprovado: () => void };

/** Link para o cliente final girar o móvel no celular e aprovar */
export function LinkCliente({ projeto, montado, catalogo, config, valorCentavos, onAprovado }: Props) {
  const logado = !!useNuvem((s) => s.sessao);
  const [st, setSt] = useState<StatusLink | null | undefined>(undefined);
  const [mostrarValor, setMostrarValor] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!logado) return;
    let vivo = true;
    const ler = () =>
      statusDoLink(projeto.id)
        .then((s) => vivo && setSt(s))
        .catch(() => vivo && setSt(null));
    void ler();
    const t = setInterval(ler, 30_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [logado, projeto.id]);

  // cliente aprovou pelo link: o orçamento passa para "Aprovado"
  useEffect(() => {
    if (st?.aprovado_em && projeto.orcamento?.status !== 'aprovado') onAprovado();
  }, [st?.aprovado_em]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!nuvemAtiva) return null;
  if (!logado) return <p className="text-[12px] text-tinta-3">Entre com sua conta para mandar o 3D para o cliente.</p>;

  const publicar = async () => {
    setOcupado(true);
    setErro('');
    try {
      const o = projeto.orcamento;
      const dados = montarDadosLink({ projeto, montado, catalogo, config, valorCentavos: mostrarValor ? valorCentavos : undefined, validade: o ? dataValidade(o) : undefined, observacao: o?.formaPagamento });
      setSt(await publicarLink(projeto.id, dados));
      rastrear('link_3d', { acao: st ? 'atualizou' : 'criou', pecas: dados.pecas.length });
    } catch (e) {
      setErro((e as Error).message || 'Não deu para criar o link agora.');
    } finally {
      setOcupado(false);
    }
  };

  const url = st?.ativo ? urlDoLink(st.token) : '';
  const fone = (projeto.cliente?.telefone ?? '').replace(/\D/g, '');
  const wa = `https://wa.me/${fone.length >= 10 ? (fone.length <= 11 ? '55' : '') + fone : ''}?text=${encodeURIComponent(`Olá${projeto.cliente?.nome ? `, ${projeto.cliente.nome.split(' ')[0]}` : ''}! Veja o projeto de ${projeto.nome} em 3D: dá para girar, abrir as portas e aprovar por aqui:\n${url}`)}`;
  const desatualizado = st?.ativo && projeto.atualizadoEm > Date.parse(st.atualizado_em) + 2000;

  return (
    <div className="rounded-lg border border-linha bg-painel p-4">
      <div className="mb-1 flex items-center gap-2 font-cond text-[15px] font-semibold">
        <Link2 className="size-4 text-aco" /> 3D para o cliente aprovar
      </div>
      <p className="mb-3 text-[12px] text-tinta-3">O cliente abre no celular, gira o móvel, abre as portas e aprova. Ele não vê custo, lucro nem furação.</p>

      {st === undefined ? (
        <p className="text-[13px] text-tinta-3">Carregando…</p>
      ) : !st?.ativo ? (
        <>
          <Interruptor label="Mostrar o valor no link" ligado={mostrarValor} onChange={setMostrarValor} />
          <Botao variante="primario" className="mt-2 w-full" onClick={publicar} disabled={ocupado}>
            <Link2 className="size-4" /> {ocupado ? 'Criando…' : 'Criar link do 3D'}
          </Botao>
        </>
      ) : (
        <div className="space-y-2 text-[13px]">
          <div className="flex gap-1">
            <input readOnly aria-label="Link do 3D" value={url} className="h-8 min-w-0 flex-1 rounded-md border border-linha bg-painel-2 px-2 text-[12px]" onFocus={(e) => e.target.select()} />
            <Botao
              tamanho="sm"
              onClick={async () => {
                await navigator.clipboard?.writeText(url).catch(() => {});
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1500);
              }}
            >
              {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </Botao>
          </div>
          <div className="flex flex-wrap gap-1">
            <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1.5 rounded-md border border-linha bg-painel px-2.5 text-[13px] font-medium hover:bg-painel-2">
              <MessageCircle className="size-3.5" /> WhatsApp
            </a>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1.5 rounded-md border border-linha bg-painel px-2.5 text-[13px] font-medium hover:bg-painel-2">
              <Eye className="size-3.5" /> Ver como o cliente
            </a>
          </div>
          {st.aprovado_em ? (
            <div className="rounded-md bg-[#e3f0e6] px-3 py-2 text-ok">
              <div className="flex items-center gap-1.5 font-medium">
                <ThumbsUp className="size-4" /> Aprovado por {st.aprovado_nome} em {quando(st.aprovado_em)}
              </div>
              {st.comentario && <p className="mt-1 text-tinta-2">“{st.comentario}”</p>}
            </div>
          ) : (
            <p className="text-tinta-2">{st.visto_em ? `O cliente abriu em ${quando(st.visto_em)}. Ainda não aprovou.` : 'O cliente ainda não abriu.'}</p>
          )}
          {desatualizado && <p className="text-[12px] text-[#9a5b12]">Você mudou o projeto depois de criar o link. Atualize para o cliente ver a versão nova.</p>}
          <div className="flex flex-wrap gap-x-3 border-t border-linha pt-2 text-[12px]">
            <button className="inline-flex items-center gap-1 text-aco hover:underline disabled:opacity-50" disabled={ocupado} onClick={publicar}>
              <RefreshCw className="size-3" /> Atualizar com a versão atual{st.aprovado_em ? ' (pede nova aprovação)' : ''}
            </button>
            <button
              className="text-tinta-3 hover:text-perigo"
              onClick={async () => {
                await desativarLink(projeto.id);
                setSt({ ...st, ativo: false });
              }}
            >
              Desligar link
            </button>
          </div>
        </div>
      )}
      {erro && <p className="mt-2 text-[12px] text-perigo">{erro}</p>}
    </div>
  );
}
