/**
 * Armazenamento do período de teste (Vercel Blob, privado).
 * Sem BLOB_READ_WRITE_TOKEN (rodando local/testes), usa memória.
 *
 * Organização:
 *   marcenarias/<instalacao>.json   resumo por marcenaria (totais, dias, últimos eventos)
 *   eventos/<dia>/<instalacao>/<ts>.json   lotes brutos, para análise depois
 *   feedback/<ts>-<id>.json          mensagem
 *   feedback/img/<id>.jpg            print da tela
 */
import { get, list, put } from '@vercel/blob';

export type Req = { method?: string; body?: unknown; query: Record<string, string | string[] | undefined>; headers: Record<string, string | string[] | undefined> };
export type Res = {
  status: (n: number) => Res;
  json: (b: unknown) => void;
  send: (b: unknown) => void;
  setHeader: (k: string, v: string) => void;
};

const memoria = new Map<string, { corpo: Buffer; tipo: string; em: number }>();
const usarMemoria = () => !process.env.BLOB_READ_WRITE_TOKEN;
export const limparMemoria = () => memoria.clear();

export async function gravar(caminho: string, corpo: string | Buffer, tipo = 'application/json') {
  if (usarMemoria()) {
    memoria.set(caminho, { corpo: Buffer.isBuffer(corpo) ? corpo : Buffer.from(corpo), tipo, em: Date.now() });
    return;
  }
  await put(caminho, corpo, { access: 'private', contentType: tipo, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
}

export async function lerBuffer(caminho: string): Promise<{ corpo: Buffer; tipo: string } | null> {
  if (usarMemoria()) return memoria.get(caminho) ?? null;
  const r = await get(caminho, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  const ab = await new Response(r.stream).arrayBuffer();
  return { corpo: Buffer.from(ab), tipo: r.blob.contentType ?? 'application/octet-stream' };
}

export async function lerJson<T>(caminho: string): Promise<T | null> {
  const b = await lerBuffer(caminho);
  if (!b) return null;
  try {
    return JSON.parse(b.corpo.toString('utf8')) as T;
  } catch {
    return null;
  }
}

export async function listar(prefixo: string, limite = 1000): Promise<{ caminho: string; em: number }[]> {
  if (usarMemoria())
    return [...memoria.entries()]
      .filter(([k]) => k.startsWith(prefixo))
      .map(([k, v]) => ({ caminho: k, em: v.em }))
      .slice(0, limite);
  const out: { caminho: string; em: number }[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: prefixo, limit: Math.min(1000, limite - out.length), cursor });
    for (const b of r.blobs) out.push({ caminho: b.pathname, em: new Date(b.uploadedAt).getTime() });
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor && out.length < limite);
  return out;
}

// ---------------------------------------------------------------------------
export const idValido = (s: unknown): s is string => typeof s === 'string' && /^[a-zA-Z0-9-]{6,64}$/.test(s);
export const texto = (s: unknown, max: number) => (typeof s === 'string' ? s.slice(0, max) : '');

export type Identidade = { instalacao: string; empresa: string; responsavel: string; telefone: string; cidade: string; versao: string };

export function lerIdentidade(b: Record<string, unknown>): Identidade | null {
  if (!idValido(b.instalacao)) return null;
  return {
    instalacao: b.instalacao,
    empresa: texto(b.empresa, 120),
    responsavel: texto(b.responsavel, 120),
    telefone: texto(b.telefone, 40),
    cidade: texto(b.cidade, 120),
    versao: texto(b.versao, 20),
  };
}

export function corpoJson(req: Req): Record<string, unknown> | null {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b as Record<string, unknown>;
  try {
    const s = Buffer.isBuffer(b) ? b.toString('utf8') : typeof b === 'string' ? b : '';
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

export type EventoBruto = { id: string; tipo: string; em: number; dados?: Record<string, unknown>; tela?: string };

export type Resumo = Identidade & {
  primeiroAcesso: number;
  ultimoAcesso: number;
  totais: Record<string, number>;
  porDia: Record<string, number>;
  recentes: EventoBruto[];
  feedbacks: number;
};

export const dia = (ms: number) => new Date(ms - 3 * 3600_000).toISOString().slice(0, 10); // horário de Brasília

/** soma um lote de eventos no resumo da marcenaria */
export function agregar(resumo: Resumo | null, id: Identidade, eventos: EventoBruto[], agora: number): Resumo {
  const r: Resumo = resumo ?? { ...id, primeiroAcesso: agora, ultimoAcesso: agora, totais: {}, porDia: {}, recentes: [], feedbacks: 0 };
  // a identidade mais recente vale (nome da marcenaria pode ser preenchido depois)
  for (const k of ['empresa', 'responsavel', 'telefone', 'cidade', 'versao'] as const) if (id[k]) r[k] = id[k];
  const vistos = new Set(r.recentes.map((e) => e.id));
  for (const e of eventos) {
    if (vistos.has(e.id)) continue;
    r.totais[e.tipo] = (r.totais[e.tipo] ?? 0) + 1;
    const d = dia(e.em);
    r.porDia[d] = (r.porDia[d] ?? 0) + 1;
    r.primeiroAcesso = Math.min(r.primeiroAcesso, e.em);
    r.ultimoAcesso = Math.max(r.ultimoAcesso, e.em);
    r.recentes.push(e);
  }
  r.recentes = r.recentes.sort((a, b) => a.em - b.em).slice(-60);
  return r;
}

export function eventosValidos(v: unknown, agora: number): EventoBruto[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 100).flatMap((e) => {
    if (!e || typeof e !== 'object') return [];
    const o = e as Record<string, unknown>;
    if (typeof o.tipo !== 'string' || !/^[a-z_]{2,40}$/.test(o.tipo)) return [];
    const em = typeof o.em === 'number' && o.em > agora - 90 * 86400_000 && o.em < agora + 600_000 ? o.em : agora;
    const dados = o.dados && typeof o.dados === 'object' && JSON.stringify(o.dados).length < 1500 ? (o.dados as Record<string, unknown>) : undefined;
    return [{ id: texto(o.id, 64) || `${em}-${Math.random()}`, tipo: o.tipo, em, dados, tela: texto(o.tela, 80) }];
  });
}

export function tokenAdminOk(req: Req): boolean {
  const esperado = process.env.ADMIN_TOKEN;
  if (!esperado) return false;
  const q = req.query.token;
  const h = req.headers['authorization'];
  const recebido = (Array.isArray(q) ? q[0] : q) ?? (typeof h === 'string' ? h.replace(/^Bearer\s+/i, '') : '');
  if (!recebido || recebido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return dif === 0;
}
