/**
 * Furação calculada pela geometria do projeto.
 *
 * - Cavilhas: onde a borda de uma peça encosta na face de outra, entram cavilhas
 *   (furo de face na peça "de fora" e furo de topo na peça que encosta).
 * - Dobradiças: caneco de 35 mm na porta (22,5 mm da borda da dobradiça) e os dois
 *   furos do calço na lateral, na mesma altura.
 * - Pinos de prateleira: prateleiras soltas apoiam em pinos nas peças dos lados.
 * - Puxador: na borda de abertura da porta, ou no centro da frente da gaveta.
 *
 * Coordenadas da peça: x ao longo do comprimento (a partir da ponta L1), y ao longo
 * da largura (a partir do lado C1, que é a frente quando a largura vai em profundidade).
 */
import type { Vec3 } from './composicao';
import type { Peca } from './types';

export type TipoUsinagem = 'cavilha' | 'caneco' | 'calco' | 'pino' | 'puxador';
export type Borda = 'c1' | 'c2' | 'l1' | 'l2';

export type Furo = {
  tipo: TipoUsinagem;
  /** face = furo na face larga; topo = furo na borda (espessura) */
  onde: 'face' | 'topo';
  x: number;
  y: number;
  /** só para furos de topo: em qual borda */
  borda?: Borda;
  /** só para furos de face: em qual das duas faces (sentido do eixo da espessura) */
  lado?: 1 | -1;
  diametro: number;
  profundidade: number | 'passante';
};

export const NOMES_USINAGEM: Record<TipoUsinagem, string> = {
  cavilha: 'Cavilha',
  caneco: 'Caneco da dobradiça',
  calco: 'Calço da dobradiça',
  pino: 'Pino de prateleira',
  puxador: 'Puxador',
};

type Eixos = { t: number; c: number; l: number };
type Lim = { min: Vec3; max: Vec3 };

const lim = (p: Peca): Lim => {
  const b = p.box3d!;
  return { min: [b.pos[0] - b.size[0] / 2, b.pos[1] - b.size[1] / 2, b.pos[2] - b.size[2] / 2], max: [b.pos[0] + b.size[0] / 2, b.pos[1] + b.size[1] / 2, b.pos[2] + b.size[2] / 2] };
};

/** qual eixo do mundo é a espessura, o comprimento e a largura da peça */
export function eixosDaPeca(p: Peca): Eixos {
  const s = p.box3d!.size;
  const t = s.indexOf(Math.min(...s));
  const outros = [0, 1, 2].filter((i) => i !== t);
  const c = outros.find((i) => Math.abs(s[i] - p.comprimento) < 1) ?? (s[outros[0]] >= s[outros[1]] ? outros[0] : outros[1]);
  const l = outros.find((i) => i !== c)!;
  return { t, c, l };
}

/** ponto do mundo → (x, y) na peça */
export function paraPeca(p: Peca, e: Eixos, w: Vec3): { x: number; y: number } {
  const L = lim(p);
  const x = w[e.c] - L.min[e.c];
  const y = e.l === 2 ? L.max[2] - w[2] : w[e.l] - L.min[e.l];
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

/** posições ao longo de uma junta de comprimento len */
function posicoesCavilha(lo: number, hi: number): number[] {
  const len = hi - lo;
  if (len < 100) return [Math.round((lo + hi) / 2)];
  if (len < 180) return [Math.round(lo + len / 4), Math.round(hi - len / 4)];
  const pts = [lo + 37, hi - 37];
  const meio = hi - 37 - (lo + 37);
  const extras = Math.floor(meio / 320);
  for (let k = 1; k <= extras; k++) pts.push(lo + 37 + (meio * k) / (extras + 1));
  return pts.map(Math.round).sort((a, b) => a - b);
}

const ehPainel = (p: Peca) => !!p.box3d && !p.somente3d && p.papel !== 'porta' && p.papel !== 'espelho' && p.papel !== 'fundo' && Math.min(...p.box3d.size) >= 8;

export function calcularFuracao(pecas: Peca[]): Map<string, Furo[]> {
  const furos = new Map<string, Furo[]>();
  const add = (id: string, f: Furo) => {
    const l = furos.get(id) ?? [];
    l.push(f);
    furos.set(id, l);
  };
  const comCaixa = pecas.filter((p) => p.box3d);
  const L = new Map(comCaixa.map((p) => [p.id, lim(p)]));
  const E = new Map(comCaixa.map((p) => [p.id, eixosDaPeca(p)]));
  const paineis = comCaixa.filter(ehPainel);

  // ---------- cavilhas: borda encostada em face ----------
  for (let i = 0; i < paineis.length; i++)
    for (let j = i + 1; j < paineis.length; j++) {
      const A = paineis[i];
      const B = paineis[j];
      const la = L.get(A.id)!;
      const lb = L.get(B.id)!;
      for (let k = 0; k < 3; k++) {
        const plano = Math.abs(la.max[k] - lb.min[k]) < 0.5 ? la.max[k] : Math.abs(lb.max[k] - la.min[k]) < 0.5 ? la.min[k] : null;
        if (plano === null) continue;
        const outros = [0, 1, 2].filter((x) => x !== k);
        const faixa = outros.map((o) => [Math.max(la.min[o], lb.min[o]), Math.min(la.max[o], lb.max[o])] as [number, number]);
        if (faixa.some(([a, b]) => b - a < 5)) continue;
        const ea = E.get(A.id)!;
        const eb = E.get(B.id)!;
        let face: Peca;
        let borda: Peca;
        if (ea.t === k && eb.t !== k) [face, borda] = [A, B];
        else if (eb.t === k && ea.t !== k) [face, borda] = [B, A];
        else continue;
        const eBorda = E.get(borda.id)!;
        const lBorda = L.get(borda.id)!;
        // ao longo da junta (o eixo que não é a espessura da peça que encosta)
        const ao = outros.find((o) => o !== eBorda.t)!;
        const [lo, hi] = faixa[outros.indexOf(ao)];
        const meioEsp = (lBorda.min[eBorda.t] + lBorda.max[eBorda.t]) / 2;
        const lFace = L.get(face.id)!;
        const ladoFace: 1 | -1 = (lBorda.min[k] + lBorda.max[k]) / 2 > (lFace.min[k] + lFace.max[k]) / 2 ? 1 : -1;
        for (const pos of posicoesCavilha(lo, hi)) {
          const w: Vec3 = [0, 0, 0];
          w[k] = plano;
          w[ao] = pos;
          w[eBorda.t] = meioEsp;
          const pf = paraPeca(face, E.get(face.id)!, w);
          add(face.id, { tipo: 'cavilha', onde: 'face', ...pf, lado: ladoFace, diametro: 8, profundidade: 12 });
          const pb = paraPeca(borda, eBorda, w);
          const bordaNome: Borda = k === eBorda.c ? (pb.x < 1 ? 'l1' : 'l2') : pb.y < 1 ? 'c1' : 'c2';
          add(borda.id, { tipo: 'cavilha', onde: 'topo', ...pb, borda: bordaNome, diametro: 8, profundidade: 25 });
        }
      }
    }

  // ---------- dobradiças ----------
  for (const porta of comCaixa) {
    const d = porta.box3d!.dobradica;
    const n = porta.furos.find((f) => f.tipo === 'dobradica_35')?.quantidade ?? 0;
    if (!d || !n || porta.somente3d) continue;
    const lp = L.get(porta.id)!;
    const e = E.get(porta.id)!;
    const comp = porta.comprimento;
    const alturas = n === 1 ? [comp / 2] : Array.from({ length: n }, (_, k) => 100 + ((comp - 200) * k) / (n - 1));
    const yDob = paraPeca(porta, e, [d.x, lp.min[1], lp.max[2]]).y;
    const yCaneco = yDob < 1 ? 22.5 : porta.largura - 22.5;
    for (const x of alturas) add(porta.id, { tipo: 'caneco', onde: 'face', x, y: yCaneco, lado: -1, diametro: 35, profundidade: 12.5 });

    // calço na lateral do lado da dobradiça
    const lateral = paineis.find((q) => {
      const lq = L.get(q.id)!;
      const enc = lq.min[0] <= d.x + 3 && lq.max[0] >= d.x - 3;
      return enc && Math.abs(lq.max[2] - d.z) < 1 && lq.max[1] > lp.min[1] && lq.min[1] < lp.max[1] && E.get(q.id)!.t === 0;
    });
    if (lateral) {
      const lq = L.get(lateral.id)!;
      const el = E.get(lateral.id)!;
      const xFace = d.sinal < 0 ? lq.max[0] : lq.min[0]; // face voltada para dentro
      for (const x of alturas) {
        const yMundo = lp.min[1] + x; // a porta tem o comprimento na vertical
        for (const dy of [-16, 16]) {
          const pt = paraPeca(lateral, el, [xFace, yMundo + dy, lq.max[2] - 37]);
          add(lateral.id, { tipo: 'calco', onde: 'face', ...pt, lado: d.sinal < 0 ? 1 : -1, diametro: 5, profundidade: 10 });
        }
      }
    }
  }

  // ---------- pinos de prateleira (prateleira solta entre duas peças) ----------
  // prateleira fixa (com cavilha) não leva pino
  for (const prat of comCaixa.filter((p) => p.papel === 'prateleira' && !p.somente3d && !p.furos.some((f) => f.tipo === 'cavilha_8'))) {
    const ls = L.get(prat.id)!;
    for (const viz of paineis) {
      if (viz.id === prat.id || E.get(viz.id)!.t !== 0) continue;
      const lv = L.get(viz.id)!;
      const folgaDir = lv.min[0] - ls.max[0];
      const folgaEsq = ls.min[0] - lv.max[0];
      const lado = folgaDir > 0.2 && folgaDir < 4 ? -1 : folgaEsq > 0.2 && folgaEsq < 4 ? 1 : 0;
      if (!lado || lv.min[1] > ls.min[1] || lv.max[1] < ls.max[1]) continue;
      const xFace = lado < 0 ? lv.min[0] : lv.max[0];
      const prof = ls.max[2] - ls.min[2];
      const zs = prof < 120 ? [(ls.min[2] + ls.max[2]) / 2] : [ls.max[2] - 37, ls.min[2] + 37];
      for (const z of zs) {
        const pt = paraPeca(viz, E.get(viz.id)!, [xFace, ls.min[1] - 6, z]);
        add(viz.id, { tipo: 'pino', onde: 'face', ...pt, lado: lado < 0 ? -1 : 1, diametro: 5, profundidade: 10 });
      }
    }
  }

  // ---------- puxador ----------
  for (const p of comCaixa) {
    const n = p.furos.find((f) => f.tipo === 'puxador')?.quantidade ?? 0;
    if (!n || p.somente3d) continue;
    const d = p.box3d!.dobradica;
    if (d) {
      const e = E.get(p.id)!;
      const lp = L.get(p.id)!;
      const yDob = paraPeca(p, e, [d.x, lp.min[1], lp.max[2]]).y;
      add(p.id, { tipo: 'puxador', onde: 'face', x: p.comprimento / 2, y: yDob < 1 ? p.largura - 40 : 40, lado: 1, diametro: 5, profundidade: 'passante' });
    } else add(p.id, { tipo: 'puxador', onde: 'face', x: p.comprimento / 2, y: p.largura / 2, lado: 1, diametro: 5, profundidade: 'passante' });
  }

  return furos;
}

/** numeração das peças que vão para o corte: P1, P2… na ordem da lista */
export function numerarPecas(pecas: Peca[]): Map<string, string> {
  let n = 0;
  return new Map(pecas.filter((p) => !p.somente3d).map((p) => [p.id, `P${++n}`]));
}

/** a face mostrada no desenho é a que tem mais furos; a outra aparece tracejada */
export function faceDeReferencia(furos: Furo[]): 1 | -1 {
  const mais = furos.filter((f) => f.onde === 'face' && f.lado === 1).length;
  const menos = furos.filter((f) => f.onde === 'face' && f.lado === -1).length;
  return menos > mais ? -1 : 1;
}
