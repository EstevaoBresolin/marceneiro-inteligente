import { faceDeReferencia, NOMES_USINAGEM, type Borda, type Furo, type TipoUsinagem } from '../domain/usinagem';
import type { Peca } from '../domain/types';

export const COR_FURO: Record<TipoUsinagem, string> = {
  cavilha: '#2f5d7c',
  caneco: '#b3412f',
  calco: '#7e5a36',
  pino: '#3d7a4f',
  puxador: '#59646a',
};

export type FuroDesenho = { x: number; y: number; r: number; cor: string; faceVisivel: boolean; tipo: TipoUsinagem };
export type TopoDesenho = { x: number; y: number; w: number; h: number; cor: string; borda: Borda };
export type LinhaTabela = { tipo: string; onde: string; pos: string; medida: string; qtd: number; cor: string };

export type GeometriaDesenho = {
  C: number;
  W: number;
  espelhado: boolean;
  fitas: Borda[];
  furos: FuroDesenho[];
  topos: TopoDesenho[];
  tabela: LinhaTabela[];
};

/**
 * Desenho da peça vista de frente pela face que tem mais furos.
 * x vai da ponta L1 (esquerda) até L2; y vai do lado C1 (embaixo) até C2.
 * Se a face mostrada for a de trás, o desenho é espelhado (L1 passa para a direita).
 */
export function geometriaDesenho(p: Peca, furos: Furo[]): GeometriaDesenho {
  const C = p.comprimento;
  const W = p.largura;
  const ref = faceDeReferencia(furos);
  const espelhado = ref === -1;
  const fx = (x: number) => (espelhado ? C - x : x);
  const fitas = (['c1', 'c2', 'l1', 'l2'] as Borda[]).filter((b) => p.bordas[b]);

  const furosD: FuroDesenho[] = furos
    .filter((f) => f.onde === 'face')
    .map((f) => ({ x: fx(f.x), y: f.y, r: f.diametro / 2, cor: COR_FURO[f.tipo], faceVisivel: (f.lado ?? 1) === ref, tipo: f.tipo }));

  const topos: TopoDesenho[] = furos
    .filter((f) => f.onde === 'topo')
    .map((f) => {
      const prof = typeof f.profundidade === 'number' ? f.profundidade : 25;
      const d = f.diametro;
      const b = f.borda!;
      if (b === 'l1' || b === 'l2') {
        const naEsquerda = (b === 'l1') !== espelhado;
        return { x: naEsquerda ? 0 : C - prof, y: f.y - d / 2, w: prof, h: d, cor: COR_FURO[f.tipo], borda: b };
      }
      return { x: fx(f.x) - d / 2, y: b === 'c1' ? 0 : W - prof, w: d, h: prof, cor: COR_FURO[f.tipo], borda: b };
    });

  // tabela agrupada: mesmo tipo, face/borda e medida
  const grupos = new Map<string, LinhaTabela & { xs: number[]; ys: number[] }>();
  for (const f of furos) {
    const onde = f.onde === 'topo' ? `topo ${f.borda!.toUpperCase()}` : (f.lado ?? 1) === ref ? 'face mostrada' : 'face de trás';
    const medida = `Ø${f.diametro} × ${f.profundidade === 'passante' ? 'passante' : `${f.profundidade} mm`}`;
    const k = `${f.tipo}|${onde}|${medida}`;
    const g = grupos.get(k) ?? { tipo: NOMES_USINAGEM[f.tipo], onde, pos: '', medida, qtd: 0, cor: COR_FURO[f.tipo], xs: [], ys: [] };
    g.qtd++;
    const x = Math.round(fx(f.x));
    const y = Math.round(f.y);
    if (f.onde === 'topo' && (f.borda === 'l1' || f.borda === 'l2')) g.ys.push(y);
    else if (f.onde === 'topo') g.xs.push(x);
    else {
      g.xs.push(x);
      g.ys.push(y);
    }
    grupos.set(k, g);
  }
  const uniq = (v: number[]) => [...new Set(v)].sort((a, b) => a - b).join(', ');
  const tabela = [...grupos.values()].map(({ xs, ys, ...g }) => ({
    ...g,
    pos: [xs.length ? `x: ${uniq(xs)}` : '', ys.length ? `y: ${uniq(ys)}` : ''].filter(Boolean).join(' · '),
  }));

  return { C, W, espelhado, fitas, furos: furosD, topos, tabela };
}

/** chave para juntar desenhos idênticos (mesmo nome, medida, fita e furos) */
export function assinaturaDesenho(p: Peca, furos: Furo[]) {
  const f = [...furos].map((x) => `${x.tipo}${x.onde}${x.borda ?? ''}${x.lado ?? ''}${Math.round(x.x)}:${Math.round(x.y)}`).sort().join('|');
  return `${p.nome.replace(/^.*?: /, '')}|${p.comprimento}x${p.largura}|${p.chapaId}|${JSON.stringify(p.bordas)}|${f}`;
}
