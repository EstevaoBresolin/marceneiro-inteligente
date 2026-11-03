import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import type { Catalogo, Config, Projeto } from '../domain/types';
import { db, gravarKv, lerKv } from './db';
import { ouvirMudancas, type Mudanca } from './mudancas';
import { mesclar, type Pendentes, type ProjetoRemoto } from './mescla';

/**
 * Login e cópia dos dados no Supabase.
 *
 * O navegador continua sendo a fonte de trabalho (IndexedDB): tudo abre na hora e funciona sem internet.
 * Cada mudança entra numa fila (guardada no IndexedDB) e sobe para a nuvem alguns segundos depois.
 * Ao entrar, ao voltar para a aba e a cada poucos minutos, o app puxa o que mudou em outro computador.
 * Conflito: vale a versão mais nova (atualizadoEm).
 */

const URL_SB = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CHAVE_SB = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const nuvemAtiva = !!(URL_SB && CHAVE_SB);
export const supabase: SupabaseClient | null = nuvemAtiva
  ? createClient(URL_SB!, CHAVE_SB!, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export type StatusNuvem = 'desligada' | 'sincronizando' | 'ok' | 'offline' | 'erro';

type EstadoNuvem = {
  pronto: boolean; // já sabemos se há sessão
  sessao: Session | null;
  recuperandoSenha: boolean;
  status: StatusNuvem;
  ultimaSinc: number | null;
  /** já tentou puxar da nuvem pelo menos uma vez nesta sessão */
  puxouUmaVez: boolean;
};

export const useNuvem = create<EstadoNuvem>(() => ({
  pronto: !nuvemAtiva,
  sessao: null,
  recuperandoSenha: false,
  status: nuvemAtiva ? 'sincronizando' : 'desligada',
  ultimaSinc: null,
  puxouUmaVez: !nuvemAtiva,
}));


/** Ponte com o store (injetada pelo store para evitar import circular). */
export type PonteStore = {
  projetos: () => Projeto[];
  catalogo: () => Catalogo;
  config: () => Config;
  aplicar: (r: { gravar: Projeto[]; apagar: string[]; catalogo?: Catalogo; config?: Config }) => Promise<void>;
  limparLocal: () => Promise<void>;
};
let ponte: PonteStore | null = null;

const uid = () => useNuvem.getState().sessao?.user.id ?? null;

async function lerPendentes(): Promise<Pendentes> {
  return (await lerKv<Pendentes>('pendentes')) ?? { projetos: [], perfil: false };
}

let fila: Promise<unknown> = Promise.resolve();
/** serializa leituras/escritas da fila para não perder marcações */
function emOrdem<T>(fn: () => Promise<T>): Promise<T> {
  const p = fila.then(fn, fn);
  fila = p.catch(() => {});
  return p;
}

let timer: ReturnType<typeof setTimeout> | null = null;
function agendarEnvio(ms = 1500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void enviar(), ms);
}

async function registrar(m: Mudanca) {
  await emOrdem(async () => {
    const p = await lerPendentes();
    if ('projeto' in m) {
      if (!p.projetos.includes(m.projeto)) p.projetos.push(m.projeto);
    } else {
      p.perfil = true;
      await gravarKv('perfilEm', Date.now());
    }
    await gravarKv('pendentes', p);
  });
  if (uid()) {
    useNuvem.setState({ status: navigator.onLine === false ? 'offline' : 'sincronizando' });
    agendarEnvio();
  }
}

let enviando: Promise<void> | null = null;
/** sobe a fila para o Supabase */
export function enviar(): Promise<void> {
  if (enviando) return enviando.then(() => enviar());
  enviando = (async () => {
    const user = uid();
    if (!supabase || !user || !ponte) return;
    const p = await emOrdem(lerPendentes);
    if (!p.projetos.length && !p.perfil) {
      useNuvem.setState({ status: 'ok' });
      return;
    }
    useNuvem.setState({ status: 'sincronizando' });
    try {
      if (p.projetos.length) {
        const locais = new Map(ponte.projetos().map((x) => [x.id, x]));
        const linhas = p.projetos.map((id) => {
          const pr = locais.get(id);
          return pr
            ? { user_id: user, id, dados: pr, apagado: false, atualizado_em: pr.atualizadoEm }
            : { user_id: user, id, dados: null, apagado: true, atualizado_em: Date.now() };
        });
        for (let i = 0; i < linhas.length; i += 50) {
          const { error } = await supabase.from('projetos').upsert(linhas.slice(i, i + 50));
          if (error) throw error;
        }
      }
      if (p.perfil) {
        let em = (await lerKv<number>('perfilEm')) || 0;
        if (!em) await gravarKv('perfilEm', (em = Date.now()));
        const { error } = await supabase.from('perfis').upsert({ user_id: user, catalogo: ponte.catalogo(), config: ponte.config(), atualizado_em: em });
        if (error) throw error;
      }
      // tira da fila só o que foi enviado (algo pode ter mudado enquanto isso)
      await emOrdem(async () => {
        const agora = await lerPendentes();
        const envi = new Set(p.projetos);
        const resto = { projetos: agora.projetos.filter((id) => !envi.has(id)), perfil: agora.perfil && !p.perfil };
        await gravarKv('pendentes', resto);
        if (resto.projetos.length || resto.perfil) agendarEnvio(300);
      });
      useNuvem.setState({ status: 'ok', ultimaSinc: Date.now() });
    } catch (e) {
      console.warn('[nuvem] falha ao enviar', e);
      useNuvem.setState({ status: navigator.onLine === false ? 'offline' : 'erro' });
      agendarEnvio(15000);
    }
  })().finally(() => {
    enviando = null;
  });
  return enviando;
}

/** traz da nuvem o que é mais novo que o local e marca para envio o que é mais novo aqui */
export async function puxar(): Promise<void> {
  const user = uid();
  if (!supabase || !user || !ponte) return;
  useNuvem.setState({ status: 'sincronizando' });
  try {
    const remotos: ProjetoRemoto[] = [];
    for (let de = 0; ; de += 500) {
      const { data, error } = await supabase.from('projetos').select('id,dados,apagado,atualizado_em').range(de, de + 499);
      if (error) throw error;
      remotos.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    const { data: perfil, error: e2 } = await supabase.from('perfis').select('catalogo,config,atualizado_em').maybeSingle();
    if (e2) throw e2;

    const pend = await emOrdem(lerPendentes);
    const perfilEm = (await lerKv<number>('perfilEm')) ?? 0;
    const { gravar, apagar, subir, catalogo, config, subirPerfil } = mesclar({ remotos, locais: ponte.projetos(), pendentes: pend, perfil, perfilEm });
    if (catalogo || config) await gravarKv('perfilEm', perfil!.atualizado_em);
    await ponte.aplicar({ gravar, apagar, catalogo, config });
    if (subir.size || subirPerfil) {
      await emOrdem(async () => {
        const p = await lerPendentes();
        for (const id of subir) if (!p.projetos.includes(id)) p.projetos.push(id);
        p.perfil = p.perfil || subirPerfil;
        await gravarKv('pendentes', p);
      });
    }
    useNuvem.setState({ ultimaSinc: Date.now() });
    await enviar();
  } catch (e) {
    console.warn('[nuvem] falha ao puxar', e);
    useNuvem.setState({ status: navigator.onLine === false ? 'offline' : 'erro' });
  } finally {
    useNuvem.setState({ puxouUmaVez: true });
  }
}

/** Ao entrar com uma conta: se o navegador tinha dados de outra conta, limpa antes de puxar. */
async function aoEntrar(s: Session) {
  if (!ponte) return;
  const dono = await lerKv<string>('dono');
  if (dono && dono !== s.user.id) {
    await ponte.limparLocal();
    await gravarKv('pendentes', { projetos: [], perfil: false });
    await gravarKv('perfilEm', 0);
  }
  // sem dono = dados de antes do login: sobem para esta conta
  await gravarKv('dono', s.user.id);
  await puxar();
}

let iniciado = false;
export function iniciarNuvem(p: PonteStore) {
  ponte = p;
  if (!supabase || iniciado) return;
  iniciado = true;
  ouvirMudancas((m) => void registrar(m));
  let ultimoUser: string | null = null;
  supabase.auth.onAuthStateChange((evento, sessao) => {
    useNuvem.setState({ sessao, pronto: true, ...(evento === 'PASSWORD_RECOVERY' ? { recuperandoSenha: true } : {}) });
    const id = sessao?.user.id ?? null;
    if (id && id !== ultimoUser) setTimeout(() => void aoEntrar(sessao!), 0); // fora do callback do auth
    ultimoUser = id;
  });
  let ultimoPuxar = Date.now();
  const talvezPuxar = () => {
    if (uid() && Date.now() - ultimoPuxar > 30_000) {
      ultimoPuxar = Date.now();
      void puxar();
    }
  };
  addEventListener('focus', talvezPuxar);
  addEventListener('online', () => uid() && void enviar());
  addEventListener('offline', () => uid() && useNuvem.setState({ status: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void enviar();
    else talvezPuxar();
  });
  setInterval(talvezPuxar, 3 * 60_000);
}

export async function sair() {
  if (!supabase || !ponte) return;
  await enviar();
  const p = await lerPendentes();
  if (p.projetos.length || p.perfil) {
    if (!confirm('Ainda tem mudanças que não subiram para a nuvem (sem internet?). Se sair agora, elas se perdem. Sair mesmo assim?')) return;
  }
  await supabase.auth.signOut();
  await ponte.limparLocal();
  await gravarKv('pendentes', { projetos: [], perfil: false });
  await gravarKv('perfilEm', 0);
  await db.kv.delete('dono');
  location.hash = '#/projetos';
}
