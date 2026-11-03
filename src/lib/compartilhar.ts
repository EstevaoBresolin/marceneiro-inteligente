import type { ProjetoMontado } from '../domain/composicao';
import type { Catalogo, Config, Peca, Projeto } from '../domain/types';
import { supabase } from './nuvem';

/** O que o cliente recebe: só o necessário para ver o móvel (nada de custo nem furação). */
export type DadosLink = {
  versao: 1;
  projeto: string;
  cliente?: string;
  empresa: { nome: string; telefone: string; cidade: string; logo: string | null };
  pecas: Pick<Peca, 'id' | 'nome' | 'papel' | 'chapaId' | 'comprimento' | 'largura' | 'box3d' | 'somente3d' | 'dependeDe'>[];
  chapas: { id: string; nome: string; cor: string; padrao?: string }[];
  modulos: { id: string; nome: string; limitesLocais: { min: [number, number, number]; max: [number, number, number] }; posicao: [number, number, number] }[];
  medidas: [number, number, number] | null;
  valorCentavos?: number;
  validade?: string;
  prazoEntregaDias?: number;
  observacao?: string;
};

export type StatusLink = { token: string; atualizado_em: string; visto_em: string | null; aprovado_em: string | null; aprovado_nome: string | null; comentario: string | null; ativo: boolean };
export type LinkPublico = { dados: DadosLink; atualizado_em: string; aprovado_em: string | null; aprovado_nome: string | null; comentario: string | null };

export function montarDadosLink(o: { projeto: Projeto; montado: ProjetoMontado; catalogo: Catalogo; config: Config; valorCentavos?: number; validade?: string; observacao?: string }): DadosLink {
  const { projeto, montado, catalogo, config } = o;
  const usadas = new Set(montado.pecas.map((p) => p.chapaId));
  const l = montado.limites;
  return {
    versao: 1,
    projeto: projeto.nome,
    cliente: projeto.cliente?.nome || undefined,
    empresa: { nome: config.empresa.nome, telefone: config.empresa.telefone, cidade: config.empresa.cidade, logo: config.empresa.logo },
    pecas: montado.pecas.filter((p) => p.box3d).map((p) => ({ id: p.id, nome: p.nome, papel: p.papel, chapaId: p.chapaId, comprimento: p.comprimento, largura: p.largura, box3d: p.box3d, somente3d: p.somente3d, dependeDe: p.dependeDe })),
    chapas: catalogo.chapas.filter((c) => usadas.has(c.id)).map((c) => ({ id: c.id, nome: c.nome, cor: c.cor, padrao: c.padrao })),
    modulos: montado.modulos.map((m) => ({ id: m.modulo.id, nome: m.modulo.nome, limitesLocais: m.limitesLocais, posicao: m.modulo.posicao })),
    medidas: l ? [0, 1, 2].map((i) => Math.round(l.max[i] - l.min[i])) as [number, number, number] : null,
    valorCentavos: o.valorCentavos,
    validade: o.validade,
    prazoEntregaDias: projeto.orcamento?.prazoEntregaDias,
    observacao: o.observacao,
  };
}

export const urlDoLink = (token: string) => `${location.origin}${location.pathname}#/ver/${token}`;

const COLUNAS = 'token,atualizado_em,visto_em,aprovado_em,aprovado_nome,comentario,ativo';

export async function statusDoLink(projetoId: string): Promise<StatusLink | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('compartilhamentos').select(COLUNAS).eq('projeto_id', projetoId).maybeSingle();
  if (error) throw error;
  return data as StatusLink | null;
}

/** cria ou atualiza o link do projeto; atualizar pede aprovação de novo */
export async function publicarLink(projetoId: string, dados: DadosLink): Promise<StatusLink> {
  if (!supabase) throw new Error('Entre com sua conta para criar o link.');
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Entre com sua conta para criar o link.');
  const { data, error } = await supabase
    .from('compartilhamentos')
    .upsert({ user_id: u.user.id, projeto_id: projetoId, dados, ativo: true, atualizado_em: new Date().toISOString(), aprovado_em: null, aprovado_nome: null, comentario: null }, { onConflict: 'user_id,projeto_id' })
    .select(COLUNAS)
    .single();
  if (error) throw error;
  return data as StatusLink;
}

export async function desativarLink(projetoId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('compartilhamentos').update({ ativo: false }).eq('projeto_id', projetoId);
  if (error) throw error;
}

export async function abrirLink(token: string): Promise<LinkPublico | null> {
  if (!supabase) throw new Error('Link indisponível.');
  const { data, error } = await supabase.rpc('ver_compartilhamento', { t: token });
  if (error) throw error;
  return data as LinkPublico | null;
}

export async function aprovarLink(token: string, nome: string, comentario: string): Promise<{ aprovado_em: string; aprovado_nome: string } | null> {
  if (!supabase) throw new Error('Link indisponível.');
  const { data, error } = await supabase.rpc('aprovar_compartilhamento', { t: token, nome, comentario });
  if (error) throw error;
  return data;
}
