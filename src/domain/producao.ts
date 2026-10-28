import type { Contexto } from '../templates';
import { montarProjeto } from './composicao';
import type { Peca, Projeto } from './types';

export type ItemProducao = { projeto: Projeto; quantidade: number };

/** rótulo curto para saber de qual pedido é a peça na serra: cliente, ou o nome do projeto */
export function etiquetaProjeto(p: Projeto) {
  const base = (p.cliente?.nome || p.nome).trim();
  const curto = base.split(/\s+/).slice(0, 2).join(' ');
  return curto.length > 16 ? `${curto.slice(0, 15)}…` : curto;
}

/** junta as peças de vários projetos (quantidade já multiplicada), com id e nome prefixados */
export function pecasDaProducao(itens: ItemProducao[], ctx: Contexto): Peca[] {
  const out: Peca[] = [];
  for (const it of itens) {
    if (it.quantidade <= 0) continue;
    const m = montarProjeto(it.projeto, ctx);
    const eti = etiquetaProjeto(it.projeto);
    for (const p of m.pecas) {
      if (p.somente3d || p.quantidade <= 0) continue;
      out.push({ ...p, id: `${it.projeto.id}|${p.id}`, nome: `${eti} · ${p.nome}`, quantidade: p.quantidade * it.quantidade, box3d: undefined });
    }
  }
  return out;
}

/** peças de um projeto só, para comparar com o corte separado */
export function pecasDoProjeto(projeto: Projeto, ctx: Contexto): Peca[] {
  return montarProjeto(projeto, ctx).pecas.filter((p) => !p.somente3d && p.quantidade > 0);
}
