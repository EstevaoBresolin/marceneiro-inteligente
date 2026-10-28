import { normalizarProjeto } from '../domain/composicao';
import type { Catalogo, Config, Projeto } from '../domain/types';

export const FORMATO = 'marceneiro-inteligente';
export const VERSAO_BACKUP = 1;

export type ArquivoBackup = {
  formato: typeof FORMATO;
  versao: number;
  tipo: 'completo' | 'projeto';
  geradoEm: string;
  empresa?: string;
  projetos: Projeto[];
  catalogo?: Catalogo;
  config?: Config;
};

export function montarBackup(projetos: Projeto[], catalogo: Catalogo, config: Config): ArquivoBackup {
  return { formato: FORMATO, versao: VERSAO_BACKUP, tipo: 'completo', geradoEm: new Date().toISOString(), empresa: config.empresa.nome, projetos, catalogo, config };
}

export function montarBackupProjeto(p: Projeto, config: Config): ArquivoBackup {
  return { formato: FORMATO, versao: VERSAO_BACKUP, tipo: 'projeto', geradoEm: new Date().toISOString(), empresa: config.empresa.nome, projetos: [p] };
}

export type Leitura = { ok: true; arquivo: ArquivoBackup } | { ok: false; erro: string };

/** valida um arquivo de backup sem confiar no conteúdo */
export function lerBackup(texto: string): Leitura {
  let v: unknown;
  try {
    v = JSON.parse(texto);
  } catch {
    return { ok: false, erro: 'Esse arquivo não é um backup do Marceneiro Inteligente (não é JSON).' };
  }
  const o = v as Partial<ArquivoBackup>;
  if (!o || o.formato !== FORMATO) return { ok: false, erro: 'Esse arquivo não é um backup do Marceneiro Inteligente.' };
  if (typeof o.versao !== 'number' || o.versao > VERSAO_BACKUP) return { ok: false, erro: 'Esse backup é de uma versão mais nova do sistema. Recarregue a página e tente de novo.' };
  if (!Array.isArray(o.projetos)) return { ok: false, erro: 'O backup não tem a lista de projetos.' };
  const projetos = o.projetos.filter((p): p is Projeto => !!p && typeof p === 'object' && typeof (p as Projeto).id === 'string' && typeof (p as Projeto).nome === 'string' && Array.isArray((p as Projeto).pecas)).map(normalizarProjeto);
  const catalogo = o.catalogo && Array.isArray(o.catalogo.chapas) && Array.isArray(o.catalogo.fitas) && Array.isArray(o.catalogo.ferragens) ? o.catalogo : undefined;
  const config = o.config && typeof o.config === 'object' && o.config.servico && o.config.venda ? o.config : undefined;
  return { ok: true, arquivo: { formato: FORMATO, versao: o.versao, tipo: o.tipo === 'projeto' ? 'projeto' : 'completo', geradoEm: String(o.geradoEm ?? ''), empresa: o.empresa, projetos, catalogo, config } };
}

/**
 * Junta projetos do backup com os atuais.
 * - mesclar: mantém os atuais; os do backup entram (o mais recente vence se o id for igual)
 * - substituir: fica só o que veio no backup
 */
export function combinarProjetos(atuais: Projeto[], doBackup: Projeto[], modo: 'mesclar' | 'substituir'): Projeto[] {
  if (modo === 'substituir') return doBackup;
  const m = new Map(atuais.map((p) => [p.id, p]));
  for (const p of doBackup) {
    const a = m.get(p.id);
    if (!a || (p.atualizadoEm ?? 0) >= (a.atualizadoEm ?? 0)) m.set(p.id, p);
  }
  return [...m.values()].sort((a, b) => (b.atualizadoEm ?? 0) - (a.atualizadoEm ?? 0));
}

export const nomeArquivoBackup = (empresa: string) => {
  const d = new Date();
  const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const slug = (empresa || 'marcenaria')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `backup-${slug}-${data}.json`;
};
