import type { Chapa, Peca } from '../domain/types';
import { otimizar } from './search';
import type { PecaCorte, ResultadoCorte } from './types';

export { otimizar } from './search';
export { validarResultado, guilhotinavel } from './validate';
export type * from './types';

/** menos peças sem caber → menor custo de chapas → maior aproveitamento */
function melhorTamanho(a: ResultadoCorte, b: ResultadoCorte) {
  if (a.naoCabem.length !== b.naoCabem.length) return a.naoCabem.length < b.naoCabem.length;
  const ca = a.chapas.length * (a.chapa.precoCentavos ?? 0);
  const cb = b.chapas.length * (b.chapa.precoCentavos ?? 0);
  if (ca !== cb) return ca < cb;
  return a.aproveitamentoMedio > b.aproveitamentoMedio;
}

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
    const tamanhos = [{ largura: c.largura, altura: c.altura, precoCentavos: c.precoCentavos }, ...(c.tamanhos ?? [])].filter((t) => t.largura > 0 && t.altura > 0);
    const tempo = Math.max(120, Math.floor(tempoPorGrupo / tamanhos.length));
    let melhor: ResultadoCorte | null = null;
    for (const t of tamanhos) {
      const r = otimizar({
        pecas: lista,
        chapa: { id: c.id, nome: c.nome, largura: t.largura, altura: t.altura, temVeio: c.temVeio, precoCentavos: t.precoCentavos },
        kerf: opts.kerf,
        refilo: opts.refilo,
        tempoMs: tempo,
      });
      if (!melhor || melhorTamanho(r, melhor)) melhor = r;
    }
    if (tamanhos.length > 1) melhor!.alternativas = tamanhos.length;
    grupos.push(melhor!);
  }
  return { grupos, semChapa };
}
