/**
 * Registro de uso simples para o período de teste.
 * Os eventos ficam numa fila no navegador e vão em lote para /api/eventos
 * (a cada 20 s e quando a aba é fechada). Sem rede, ficam guardados e vão depois.
 */

export type Evento = { id: string; tipo: string; em: number; dados?: Record<string, unknown>; tela?: string };

export type Identidade = { instalacao: string; empresa: string; responsavel: string; telefone: string; cidade: string; versao: string };

const CHAVE_ID = 'mi-instalacao';
const CHAVE_FILA = 'mi-eventos';
const CHAVE_FEEDBACK = 'mi-feedback-pendente';
const LIMITE_FILA = 500;
export const VERSAO = '0.3.0';

const temJanela = typeof window !== 'undefined';

const ler = <T,>(k: string, padrao: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
};
const gravar = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sem espaço ou bloqueado: segue só em memória */
  }
};

const novoId = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);

export function idInstalacao(): string {
  if (!temJanela) return 'teste';
  let id = '';
  try {
    id = localStorage.getItem(CHAVE_ID) ?? '';
    if (!id) {
      id = novoId();
      localStorage.setItem(CHAVE_ID, id);
    }
  } catch {
    id = 'sem-storage';
  }
  return id;
}

let obterEmpresa: () => Omit<Identidade, 'instalacao' | 'versao'> = () => ({ empresa: '', responsavel: '', telefone: '', cidade: '' });
/** o app informa de onde tirar o nome da marcenaria */
export function configurarIdentidade(fn: typeof obterEmpresa) {
  obterEmpresa = fn;
}
export const identidade = (): Identidade => ({ instalacao: idInstalacao(), versao: VERSAO, ...obterEmpresa() });

let fila: Evento[] = temJanela ? ler<Evento[]>(CHAVE_FILA, []) : [];
let enviando = false;

export function rastrear(tipo: string, dados?: Record<string, unknown>) {
  if (!temJanela) return;
  fila.push({ id: novoId(), tipo, em: Date.now(), dados, tela: location.hash || '#/' });
  if (fila.length > LIMITE_FILA) fila = fila.slice(-LIMITE_FILA);
  gravar(CHAVE_FILA, fila);
}

async function enviar(usarBeacon = false) {
  if (!temJanela || enviando || !fila.length) return;
  const lote = fila.slice(0, 100);
  const corpo = JSON.stringify({ ...identidade(), eventos: lote });
  if (usarBeacon && navigator.sendBeacon) {
    if (navigator.sendBeacon('/api/eventos', new Blob([corpo], { type: 'application/json' }))) {
      fila = fila.slice(lote.length);
      gravar(CHAVE_FILA, fila);
    }
    return;
  }
  enviando = true;
  try {
    const r = await fetch('/api/eventos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: corpo, keepalive: true });
    if (r.ok) {
      const ids = new Set(lote.map((e) => e.id));
      fila = fila.filter((e) => !ids.has(e.id));
      gravar(CHAVE_FILA, fila);
    }
  } catch {
    /* sem rede: tenta de novo depois */
  } finally {
    enviando = false;
  }
}

export type Feedback = { tipo: 'problema' | 'ideia' | 'elogio'; texto: string; imagem: string | null; tela: string; contato?: string };

async function postarFeedback(f: Feedback & { id: string; em: number }) {
  const r = await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...identidade(), ...f }) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

/** devolve true se chegou agora; false se ficou guardado para mandar depois */
export async function enviarFeedback(f: Feedback): Promise<boolean> {
  const item = { ...f, id: novoId(), em: Date.now() };
  rastrear('feedback_enviado', { tipo: f.tipo });
  try {
    await postarFeedback(item);
    return true;
  } catch {
    const pend = ler<(typeof item)[]>(CHAVE_FEEDBACK, []);
    // guarda sem a imagem se não couber
    pend.push(item);
    gravar(CHAVE_FEEDBACK, pend);
    if (ler<unknown[]>(CHAVE_FEEDBACK, []).length !== pend.length) gravar(CHAVE_FEEDBACK, [...pend.slice(0, -1), { ...item, imagem: null }]);
    return false;
  }
}

async function reenviarFeedbacks() {
  const pend = ler<(Feedback & { id: string; em: number })[]>(CHAVE_FEEDBACK, []);
  if (!pend.length) return;
  const restantes = [];
  for (const f of pend) {
    try {
      await postarFeedback(f);
    } catch {
      restantes.push(f);
    }
  }
  gravar(CHAVE_FEEDBACK, restantes);
}

let iniciado = false;
export function iniciarTelemetria() {
  if (!temJanela || iniciado) return;
  iniciado = true;
  rastrear('app_aberto', { largura: window.innerWidth, altura: window.innerHeight, toque: 'ontouchstart' in window });
  setTimeout(() => void enviar(), 4000);
  setInterval(() => void enviar(), 20000);
  setInterval(() => void reenviarFeedbacks(), 60000);
  setTimeout(() => void reenviarFeedbacks(), 6000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void enviar(true);
  });
  let erros = 0;
  window.addEventListener('error', (e) => {
    if (erros++ < 10) rastrear('erro', { msg: String(e.message).slice(0, 300), onde: `${e.filename?.split('/').pop()}:${e.lineno}` });
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (erros++ < 10) rastrear('erro', { msg: String(e.reason?.message ?? e.reason).slice(0, 300) });
  });
}
