import { Bug, Heart, Lightbulb, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Botao, Painel, TextoInput, Titulo, cx } from '../components/ui';

type Evento = { id: string; tipo: string; em: number; dados?: Record<string, unknown>; tela?: string };
type Marcenaria = {
  instalacao: string;
  empresa: string;
  responsavel: string;
  telefone: string;
  cidade: string;
  versao: string;
  primeiroAcesso: number;
  ultimoAcesso: number;
  totais: Record<string, number>;
  porDia: Record<string, number>;
  recentes: Evento[];
  feedbacks: number;
};
type Fb = { id: string; em: number; tipo: string; texto: string; tela: string; empresa: string; responsavel: string; telefone: string; instalacao: string; imagem: string | null };

const CHAVE = 'mi-admin-token';

const NOMES: Record<string, string> = {
  app_aberto: 'abriu o sistema',
  onboarding_concluido: 'concluiu o cadastro',
  projeto_criado: 'criou projeto',
  projeto_duplicado: 'duplicou projeto',
  modulo_adicionado: 'adicionou módulo',
  peca_removida: 'removeu peça',
  aba_aberta: 'abriu aba',
  exportou: 'exportou',
  orcamento_gerado: 'gerou orçamento',
  orcamento_whatsapp: 'mandou no WhatsApp',
  orcamento_status: 'mudou situação do orçamento',
  feedback_enviado: 'mandou feedback',
  erro: 'erro na tela',
};

/** o que mais importa para saber se estão usando de verdade */
const CHAVES_USO = ['projeto_criado', 'orcamento_gerado', 'exportou', 'feedback_enviado', 'erro'];

const quando = (ms: number) => {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 2) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
};

const descrever = (e: Evento) => {
  const extra = e.dados ? Object.values(e.dados).filter((v) => typeof v === 'string').join(', ') : '';
  return `${NOMES[e.tipo] ?? e.tipo}${extra ? ` (${extra})` : ''}`;
};

function Barras({ porDia }: { porDia: Record<string, number> }) {
  const dias = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(Date.now() - 3 * 3600_000 - (20 - i) * 86400_000).toISOString().slice(0, 10);
    return { d, n: porDia[d] ?? 0 };
  });
  const max = Math.max(1, ...dias.map((x) => x.n));
  return (
    <div className="flex h-10 items-end gap-[3px]" role="img" aria-label="Uso nos últimos 21 dias">
      {dias.map(({ d, n }) => (
        <div key={d} title={`${d.split('-').reverse().slice(0, 2).join('/')}: ${n} ações`} className={cx('w-2 rounded-sm', n ? 'bg-mdf' : 'bg-linha')} style={{ height: `${Math.max(8, (n / max) * 100)}%` }} />
      ))}
    </div>
  );
}

function Imagem({ caminho, token }: { caminho: string; token: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    let obj = '';
    fetch(`/api/admin?imagem=${encodeURIComponent(caminho)}`, { headers: { authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b && vivo) {
          obj = URL.createObjectURL(b);
          setUrl(obj);
        }
      })
      .catch(() => {});
    return () => {
      vivo = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [caminho, token]);
  if (!url) return <div className="grid h-24 w-40 place-items-center rounded border border-linha bg-painel-2 text-[11px] text-tinta-3">print…</div>;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Print da tela enviado com o feedback" className="h-24 w-40 rounded border border-linha object-cover object-top" />
    </a>
  );
}

export function Admin() {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(CHAVE) ?? '';
    } catch {
      return '';
    }
  });
  const [digitado, setDigitado] = useState('');
  const [dados, setDados] = useState<{ marcenarias: Marcenaria[]; feedbacks: Fb[] } | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  const carregar = async (tk = token) => {
    if (!tk) return;
    setCarregando(true);
    setErro('');
    try {
      const r = await fetch('/api/admin', { headers: { authorization: `Bearer ${tk}` } });
      if (r.status === 401) {
        setErro('Senha de admin incorreta.');
        setToken('');
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      setDados(await r.json());
      try {
        localStorage.setItem(CHAVE, tk);
      } catch {
        /* ignora */
      }
    } catch {
      setErro('Não consegui falar com o servidor. Isso só funciona no site publicado.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token)
    return (
      <div className="mx-auto max-w-sm p-8">
        <Titulo sub="Área só sua: acompanha as marcenarias do teste.">Admin</Titulo>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setToken(digitado.trim());
          }}
          className="space-y-3"
        >
          <TextoInput ariaLabel="Senha de admin" valor={digitado} onChange={setDigitado} placeholder="Senha de admin" />
          {erro && <p className="text-[13px] text-perigo">{erro}</p>}
          <Botao variante="primario" type="submit" className="w-full">
            Entrar
          </Botao>
        </form>
      </div>
    );

  const ms = dados?.marcenarias ?? [];
  const ativos7 = ms.filter((m) => Date.now() - m.ultimoAcesso < 7 * 86400_000).length;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <Titulo sub={`${ms.length} instalações · ${ativos7} usaram nos últimos 7 dias · ${dados?.feedbacks.length ?? 0} feedbacks`}>Marcenarias no teste</Titulo>
        <Botao onClick={() => carregar()} disabled={carregando}>
          <RefreshCw className={cx('size-4', carregando && 'animate-spin')} /> Atualizar
        </Botao>
      </div>
      {erro && <p className="mb-4 text-perigo">{erro}</p>}

      <div className="grid gap-3">
        {ms.map((m) => (
          <Painel key={m.instalacao} className="p-4">
            <button className="flex w-full flex-wrap items-center gap-x-6 gap-y-3 text-left" onClick={() => setAberta(aberta === m.instalacao ? null : m.instalacao)} aria-expanded={aberta === m.instalacao}>
              <div className="min-w-48 flex-1">
                <div className="font-cond text-[17px] font-semibold">{m.empresa || 'Sem nome ainda'}</div>
                <div className="text-[12px] text-tinta-3">
                  {[m.responsavel, m.telefone, m.cidade].filter(Boolean).join(' · ') || m.instalacao.slice(0, 8)}
                </div>
              </div>
              <div className="text-[13px]">
                <div className={cx('font-medium', Date.now() - m.ultimoAcesso < 3 * 86400_000 ? 'text-ok' : 'text-tinta-2')}>{quando(m.ultimoAcesso)}</div>
                <div className="text-[11px] text-tinta-3">desde {new Date(m.primeiroAcesso).toLocaleDateString('pt-BR')}</div>
              </div>
              <Barras porDia={m.porDia} />
              <dl className="flex gap-4 text-center text-[12px] num">
                {CHAVES_USO.map((k) => (
                  <div key={k}>
                    <dd className={cx('font-cond text-[18px] font-semibold', k === 'erro' && m.totais[k] ? 'text-perigo' : '')}>{m.totais[k] ?? 0}</dd>
                    <dt className="text-tinta-3">{{ projeto_criado: 'projetos', orcamento_gerado: 'orçamentos', exportou: 'exportações', feedback_enviado: 'feedbacks', erro: 'erros' }[k]}</dt>
                  </div>
                ))}
              </dl>
            </button>
            {aberta === m.instalacao && (
              <ol className="mt-3 max-h-72 space-y-1 overflow-auto border-t border-linha pt-3 text-[12px]">
                {[...m.recentes].reverse().map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="w-28 shrink-0 text-tinta-3 num">{new Date(e.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className={e.tipo === 'erro' ? 'text-perigo' : ''}>{descrever(e)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Painel>
        ))}
        {dados && !ms.length && <p className="text-tinta-2">Ninguém usou ainda. Assim que uma marcenaria abrir o link, ela aparece aqui.</p>}
      </div>

      <h2 className="mb-3 mt-10 font-cond text-xl font-semibold">Feedbacks</h2>
      <div className="grid gap-3">
        {(dados?.feedbacks ?? []).map((f) => (
          <Painel key={f.id} className="flex gap-4 p-4">
            <div className={cx('grid size-8 shrink-0 place-items-center rounded-full', f.tipo === 'problema' ? 'bg-[#fbeeeb] text-perigo' : f.tipo === 'ideia' ? 'bg-[#fbf3ea] text-mdf-escuro' : 'bg-[#e3f0e6] text-ok')}>
              {f.tipo === 'problema' ? <Bug className="size-4" /> : f.tipo === 'ideia' ? <Lightbulb className="size-4" /> : <Heart className="size-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-tinta-3">
                <b className="text-tinta">{f.empresa || 'Sem nome'}</b> · {f.responsavel} · {new Date(f.em).toLocaleString('pt-BR')} · tela {f.tela}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[14px]">{f.texto}</p>
              {f.telefone && (
                <a className="mt-1 inline-block text-[12px] text-aco hover:underline" href={`https://wa.me/55${f.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                  Responder no WhatsApp
                </a>
              )}
            </div>
            {f.imagem && <Imagem caminho={f.imagem} token={token} />}
          </Painel>
        ))}
        {dados && !dados.feedbacks.length && <p className="text-tinta-2">Nenhum feedback ainda.</p>}
      </div>

      <button className="mt-10 text-[12px] text-tinta-3 hover:text-tinta" onClick={() => (localStorage.removeItem(CHAVE), setToken(''), setDados(null))}>
        Sair do admin
      </button>
    </div>
  );
}
