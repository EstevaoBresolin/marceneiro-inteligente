import type { Catalogo, Config, Projeto } from '../domain/types';

export type Pendentes = { projetos: string[]; perfil: boolean };
export type ProjetoRemoto = { id: string; dados: Projeto | null; apagado: boolean; atualizado_em: number };
export type PerfilRemoto = { catalogo: Catalogo | null; config: Config | null; atualizado_em: number } | null;

/**
 * Decide o que vem da nuvem e o que sobe. Vale a versão mais nova;
 * o que ainda está na fila de envio deste computador sempre vence (é a mudança mais recente aqui).
 */
export function mesclar(e: { remotos: ProjetoRemoto[]; locais: Projeto[]; pendentes: Pendentes; perfil: PerfilRemoto; perfilEm: number }) {
  const locais = new Map(e.locais.map((x) => [x.id, x]));
  const gravar: Projeto[] = [];
  const apagar: string[] = [];
  const subir = new Set<string>();
  for (const r of e.remotos) {
    const l = locais.get(r.id);
    locais.delete(r.id);
    if (e.pendentes.projetos.includes(r.id)) continue;
    if (r.apagado) {
      if (l && l.atualizadoEm <= r.atualizado_em) apagar.push(r.id);
      else if (l) subir.add(r.id);
    } else if (r.dados && (!l || r.atualizado_em > l.atualizadoEm)) gravar.push(r.dados);
    else if (l && l.atualizadoEm > r.atualizado_em) subir.add(r.id);
  }
  for (const id of locais.keys()) subir.add(id); // só existem aqui

  let catalogo: Catalogo | undefined;
  let config: Config | undefined;
  let subirPerfil = false;
  if (!e.perfil) subirPerfil = true;
  else if (!e.pendentes.perfil && e.perfil.atualizado_em > e.perfilEm) {
    catalogo = e.perfil.catalogo ?? undefined;
    config = e.perfil.config ?? undefined;
  } else if (e.perfilEm > e.perfil.atualizado_em) subirPerfil = true;
  return { gravar, apagar, subir, catalogo, config, subirPerfil };
}
