import type { Chapa, Peca } from '../domain/types';
import { otimizar } from './search';
import type { PecaCorte, ResultadoCorte } from './types';

export { otimizar } from './search';
export { validarResultado, guilhotinavel } from './validate';
export type * from './types';

export type PlanoCorte = {
  /** um resultado por tipo de chapa */
  grupos: ResultadoCorte[];
  /** peças que apontam para uma chapa inexistente */
  semChapa: Peca[];
};

/** Expande quantidades (× lote) e agrupa por chapa */
export function prepararEntradas(pecas: Peca[], lote: number, chapas: Chapa[]) {
  const porChapa = new Map<string, PecaCorte[]>();
  const semChapa: Peca[] = [];
  for (const p of pecas) {
    if (p.somente3d) continue;
    const chapa = chapas.find((c) => c.id === p.chapaId);
    if (!chapa) {
      semChapa.push(p);
      continue;
    }
    const total = p.quantidade * lote;
    const lista = porChapa.get(chapa.id) ?? [];
    for (let i = 0; i < total; i++)
      lista.push({ pecaId: p.id, rotulo: p.nome, w: p.comprimento, h: p.largura, podeGirar: p.podeGirar });
    porChapa.set(chapa.id, lista);
  }
  return { porChapa, semChapa };
}

export function planejarCorte(
  pecas: Peca[],
  lote: number,
  chapas: Chapa[],
  opts: { kerf: number; refilo: number; tempoMs?: number },
): PlanoCorte {
  const { porChapa, semChapa } = prepararEntradas(pecas, lote, chapas);
  const grupos: ResultadoCorte[] = [];
  const tempoPorGrupo = Math.max(150, Math.floor((opts.tempoMs ?? 1500) / Math.max(1, porChapa.size)));
  for (const [chapaId, lista] of porChapa) {
    const c = chapas.find((x) => x.id === chapaId)!;
    grupos.push(
      otimizar({
        pecas: lista,
        chapa: { id: c.id, nome: c.nome, largura: c.largura, altura: c.altura, temVeio: c.temVeio },
        kerf: opts.kerf,
        refilo: opts.refilo,
        tempoMs: tempoPorGrupo,
      }),
    );
  }
  return { grupos, semChapa };
}
