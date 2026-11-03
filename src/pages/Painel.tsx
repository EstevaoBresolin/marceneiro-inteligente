import { CalendarPlus, MessageCircle, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Painel as Caixa, Titulo, cx } from '../components/ui';
import { diasRestantes } from '../lib/conta';
import { supabase, useNuvem } from '../lib/nuvem';

type Linha = {
  user_id: string;
  email: string | null;
  marcenaria: string | null;
  cnpj: string | null;
  responsavel: string | null;
  telefone: string | null;
  cidade: string | null;
  criado_em: string;
  teste_ate: string;
  ultimo_acesso: string | null;
  status_contato: Status;
  anotacoes: string;
  proximo_contato: string | null;
  plano: 'teste' | 'pago' | 'cortesia';
  projetos: number;
  links: number;
  aprovados: number;
  ultima_alteracao: string | null;
};

type Status = 'novo' | 'contatado' | 'usando' | 'sem_resposta' | 'quer_assinar' | 'assinou' | 'desistiu';
const STATUS: { valor: Status; label: string; cor: string }[] = [
  { valor: 'novo', label: 'Novo', cor: 'bg-aco-claro text-aco' },
  { valor: 'contatado', label: 'Contatado', cor: 'bg-painel-2 text-tinta-2' },
  { valor: 'usando', label: 'Usando', cor: 'bg-[#e3f0e6] text-ok' },
  { valor: 'sem_resposta', label: 'Sem resposta', cor: 'bg-[#fbf3ea] text-[#9a5b12]' },
  { valor: 'quer_assinar', label: 'Quer assinar', cor: 'bg-[#dff0e4] text-ok font-semibold' },
  { valor: 'assinou', label: 'Assinou', cor: 'bg-ok text-white' },
  { valor: 'desistiu', label: 'Desistiu', cor: 'bg-[#fbeeeb] text-perigo' },
];
const corStatus = (s: Status) => STATUS.find((x) => x.valor === s)?.cor ?? '';

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
function haQuanto(iso: string | null) {
  if (!iso) return 'nunca';
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
}
const hoje = () => new Date().toISOString().slice(0, 10);

function Restante({ l }: { l: Linha }) {
  if (l.plano !== 'teste') return <span className="rounded bg-painel-2 px-1.5 py-0.5 text-[12px] text-tinta-2">{l.plano === 'pago' ? 'Pago' : 'Cortesia'}</span>;
  const d = diasRestantes(l);
  return (
    <span className={cx('whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] font-semibold num', d <= 0 ? 'bg-[#fbeeeb] text-perigo' : d <= 7 ? 'bg-[#fbf3ea] text-[#9a5b12]' : 'bg-[#e3f0e6] text-ok')}>
      {d <= 0 ? `acabou ${data(l.teste_ate)}` : d === 1 ? 'último dia' : `${d} dias`}
    </span>
  );
}

/** Painel da equipe: quem está testando, quanto falta e o acompanhamento do contato */
export function Painel() {
  const sessao = useNuvem((s) => s.sessao);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'teste' | 'vencendo' | 'vencidos' | 'contatar'>('todos');

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setErro('');
    const { data: d, error } = await supabase.rpc('painel_contas');
    if (error) setErro(error.message.includes('acesso negado') ? 'Esta conta não é da equipe.' : 'Não consegui carregar agora.');
    else setLinhas(d as Linha[]);
  }, []);
  useEffect(() => {
    if (sessao) void carregar();
  }, [sessao, carregar]);

  const alterar = async (id: string, campos: Partial<Linha>) => {
    setLinhas((ls) => ls?.map((l) => (l.user_id === id ? { ...l, ...campos } : l)) ?? null);
    const { error } = await supabase!.from('contas').update(campos).eq('user_id', id);
    if (error) {
      setErro('Não salvou: ' + error.message);
      void carregar();
    }
  };
  const somarDias = (l: Linha, n: number) => {
    const base = Math.max(Date.now(), Date.parse(l.teste_ate));
    void alterar(l.user_id, { teste_ate: new Date(base + n * 86_400_000).toISOString(), plano: 'teste' });
  };

  const resumo = useMemo(() => {
    const ls = linhas ?? [];
    const teste = ls.filter((l) => l.plano === 'teste');
    return {
      total: ls.length,
      emTeste: teste.filter((l) => diasRestantes(l) > 0).length,
      vencendo: teste.filter((l) => diasRestantes(l) > 0 && diasRestantes(l) <= 7).length,
      vencidos: teste.filter((l) => diasRestantes(l) <= 0).length,
      contatar: ls.filter((l) => l.proximo_contato && l.proximo_contato <= hoje()).length,
      ativos7: ls.filter((l) => l.ultimo_acesso && Date.now() - Date.parse(l.ultimo_acesso) < 7 * 86_400_000).length,
    };
  }, [linhas]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (linhas ?? [])
      .filter((l) => !q || [l.marcenaria, l.cnpj, l.responsavel, l.email, l.cidade, l.telefone].some((x) => x?.toLowerCase().includes(q)))
      .filter((l) => {
        const d = diasRestantes(l);
        if (filtro === 'teste') return l.plano === 'teste' && d > 0;
        if (filtro === 'vencendo') return l.plano === 'teste' && d > 0 && d <= 7;
        if (filtro === 'vencidos') return l.plano === 'teste' && d <= 0;
        if (filtro === 'contatar') return !!l.proximo_contato && l.proximo_contato <= hoje();
        return true;
      });
  }, [linhas, busca, filtro]);

  if (!sessao) return <p className="p-8 text-tinta-2">Entre com a conta da equipe para ver o painel.</p>;

  const card = (k: typeof filtro, titulo: string, valor: number, destaque?: string) => (
    <button onClick={() => setFiltro(filtro === k ? 'todos' : k)} className={cx('rounded-lg border bg-painel p-3 text-left transition-colors', filtro === k ? 'border-aco ring-2 ring-aco-claro' : 'border-linha hover:border-tinta-3')}>
      <div className="text-[12px] text-tinta-3">{titulo}</div>
      <div className={cx('font-cond text-2xl font-semibold num', destaque)}>{valor}</div>
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Titulo sub="Quem criou conta, quanto falta do teste grátis de 45 dias e como está o contato. Só a equipe vê esta tela.">Marcenarias em teste</Titulo>
        <button onClick={() => void carregar()} className="flex items-center gap-1.5 rounded-md border border-linha bg-painel px-3 py-1.5 text-[13px] hover:bg-painel-2">
          <RefreshCw className="size-3.5" /> Atualizar
        </button>
      </div>
      {erro && <p className="mb-3 rounded-md bg-[#fbeeeb] px-3 py-2 text-[13px] text-perigo">{erro}</p>}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {card('todos', 'Contas', resumo.total)}
        {card('teste', 'Em teste', resumo.emTeste, 'text-ok')}
        {card('vencendo', 'Acabam em 7 dias', resumo.vencendo, 'text-[#9a5b12]')}
        {card('vencidos', 'Teste acabou', resumo.vencidos, 'text-perigo')}
        {card('contatar', 'Contatar hoje', resumo.contatar, 'text-aco')}
        <div className="rounded-lg border border-linha bg-painel p-3">
          <div className="text-[12px] text-tinta-3">Usaram nos últimos 7 dias</div>
          <div className="font-cond text-2xl font-semibold num">{resumo.ativos7}</div>
        </div>
      </div>

      <label className="mb-3 flex h-9 items-center gap-2 rounded-md border border-linha bg-painel px-2.5 sm:max-w-sm">
        <Search className="size-4 text-tinta-3" />
        <input aria-label="Buscar marcenaria" placeholder="Buscar por nome, CNPJ, cidade, e-mail…" className="h-full flex-1 bg-transparent text-[14px] outline-none" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </label>

      {linhas === null ? (
        <p className="text-tinta-3">Carregando…</p>
      ) : !visiveis.length ? (
        <p className="text-tinta-3">Nenhuma marcenaria aqui.</p>
      ) : (
        <div className="space-y-3">
          {visiveis.map((l) => {
            const fone = (l.telefone ?? '').replace(/\D/g, '');
            const wa = fone.length >= 10 ? `https://wa.me/${fone.length <= 11 ? '55' : ''}${fone}?text=${encodeURIComponent(`Olá${l.responsavel ? `, ${l.responsavel.split(' ')[0]}` : ''}! Aqui é do Marceneiro Inteligente. Como está sendo o teste?`)}` : null;
            const atrasado = l.proximo_contato && l.proximo_contato <= hoje();
            return (
              <Caixa key={l.user_id} className="p-3 sm:p-4">
                <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1.6fr]">
                  {/* quem é */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-cond text-[17px] font-semibold">{l.marcenaria || <span className="text-tinta-3">Sem nome ainda</span>}</span>
                      <Restante l={l} />
                    </div>
                    <div className="mt-0.5 text-[13px] text-tinta-2">
                      CNPJ: <span className="num">{l.cnpj || '—'}</span>
                    </div>
                    <div className="text-[13px] text-tinta-2">
                      {[l.responsavel, l.cidade].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div className="truncate text-[12px] text-tinta-3">
                      {l.email}
                      {l.telefone ? ` · ${l.telefone}` : ''}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {wa && (
                        <a href={wa} target="_blank" rel="noreferrer" onClick={() => l.status_contato === 'novo' && void alterar(l.user_id, { status_contato: 'contatado' })} className="inline-flex h-7 items-center gap-1 rounded-md bg-[#1f8a4c] px-2.5 text-[12px] font-medium text-white">
                          <MessageCircle className="size-3.5" /> WhatsApp
                        </a>
                      )}
                      {l.email && (
                        <a href={`mailto:${l.email}`} className="inline-flex h-7 items-center rounded-md border border-linha px-2.5 text-[12px] font-medium hover:bg-painel-2">
                          E-mail
                        </a>
                      )}
                    </div>
                  </div>

                  {/* uso */}
                  <dl className="grid grid-cols-2 content-start gap-x-3 gap-y-0.5 text-[13px]">
                    <dt className="text-tinta-3">Criou a conta</dt>
                    <dd className="num">{data(l.criado_em)}</dd>
                    <dt className="text-tinta-3">Teste até</dt>
                    <dd className="num">{l.plano === 'teste' ? data(l.teste_ate) : '—'}</dd>
                    <dt className="text-tinta-3">Último acesso</dt>
                    <dd>{haQuanto(l.ultimo_acesso)}</dd>
                    <dt className="text-tinta-3">Projetos</dt>
                    <dd className="num">{l.projetos}</dd>
                    <dt className="text-tinta-3">Links 3D / aprovados</dt>
                    <dd className="num">
                      {l.links} / {l.aprovados}
                    </dd>
                    <dt className="text-tinta-3">Mexeu em projeto</dt>
                    <dd>{haQuanto(l.ultima_alteracao)}</dd>
                  </dl>

                  {/* contato */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <select aria-label={`Situação de ${l.marcenaria ?? l.email}`} value={l.status_contato} onChange={(e) => void alterar(l.user_id, { status_contato: e.target.value as Status })} className={cx('h-8 rounded-md border-0 px-2 text-[13px] font-medium', corStatus(l.status_contato))}>
                        {STATUS.map((s) => (
                          <option key={s.valor} value={s.valor}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <label className={cx('flex items-center gap-1 text-[12px]', atrasado ? 'font-medium text-perigo' : 'text-tinta-3')}>
                        Próximo contato
                        <input type="date" aria-label="Próximo contato" value={l.proximo_contato ?? ''} onChange={(e) => void alterar(l.user_id, { proximo_contato: e.target.value || null })} className="h-8 rounded-md border border-linha bg-painel px-1.5 text-[13px] text-tinta" />
                      </label>
                    </div>
                    <textarea
                      aria-label="Anotações"
                      placeholder="Anotações do contato: o que falou, o que pediu, se vai assinar…"
                      rows={2}
                      defaultValue={l.anotacoes}
                      onBlur={(e) => e.target.value !== l.anotacoes && void alterar(l.user_id, { anotacoes: e.target.value })}
                      className="w-full rounded-md border border-linha bg-painel px-2.5 py-1.5 text-[13px] outline-none focus:border-aco"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                      <CalendarPlus className="size-3.5 text-tinta-3" />
                      <span className="text-tinta-3">Teste:</span>
                      {[15, 30].map((n) => (
                        <button key={n} onClick={() => somarDias(l, n)} className="rounded border border-linha px-2 py-0.5 hover:bg-painel-2">
                          +{n} dias
                        </button>
                      ))}
                      <select aria-label="Plano" value={l.plano} onChange={(e) => void alterar(l.user_id, { plano: e.target.value as Linha['plano'] })} className="h-6 rounded border border-linha bg-painel px-1 text-[12px]">
                        <option value="teste">Teste</option>
                        <option value="pago">Pago</option>
                        <option value="cortesia">Cortesia</option>
                      </select>
                    </div>
                  </div>
                </div>
              </Caixa>
            );
          })}
        </div>
      )}
    </div>
  );
}
