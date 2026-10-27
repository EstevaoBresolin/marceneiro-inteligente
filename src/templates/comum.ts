import type { Bordas, Box3d, Chapa, Catalogo, Papel, Peca, TipoFuro } from '../domain/types';

/** Caixa 3D a partir dos limites (mm) */
export function caixa(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box3d {
  return {
    pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    size: [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)],
  };
}

export const semBorda: Bordas = { c1: null, c2: null, l1: null, l2: null };

export const bordas = (fita: string | null, lados: Partial<Record<keyof Bordas, boolean>>): Bordas => ({
  c1: lados.c1 ? fita : null,
  c2: lados.c2 ? fita : null,
  l1: lados.l1 ? fita : null,
  l2: lados.l2 ? fita : null,
});

/** 2 dobradiças até 900 mm de altura de porta, 3 até 1600, 4 acima */
export const dobradicasPorPorta = (alturaPorta: number) => (alturaPorta <= 900 ? 2 : alturaPorta <= 1600 ? 3 : 4);

/** Uma peça física (quantidade 1) com o mínimo de campos */
export function peca(o: {
  id: string;
  nome: string;
  papel: Papel;
  chapa: Chapa;
  comprimento: number;
  largura: number;
  box3d: Box3d;
  bordas?: Bordas;
  furos?: { tipo: TipoFuro; quantidade: number }[];
  podeGirar?: boolean;
}): Peca {
  return {
    id: o.id,
    nome: o.nome,
    papel: o.papel,
    chapaId: o.chapa.id,
    comprimento: Math.round(o.comprimento),
    largura: Math.round(o.largura),
    quantidade: 1,
    podeGirar: o.podeGirar ?? !o.chapa.temVeio,
    bordas: o.bordas ?? { ...semBorda },
    furos: (o.furos ?? []).filter((f) => f.quantidade > 0),
    box3d: o.box3d,
  };
}

export const FUNDO_CHAPA: Record<string, string | null> = { hdf3: 'hdf-branco-3', mdf6: 'mdf-cru-6', sem: null };

export type OpcoesCaixa = {
  L: number;
  A: number;
  P: number;
  chapa: Chapa;
  fita: string | null;
  montagem: 'laterais_inteiras' | 'tampo_sobre';
  fundo: Chapa | undefined;
  fundoEmbutido: boolean;
  /** altura do rodapé (só com laterais inteiras), mm */
  rodape?: number;
  /** juntas a mais em cada lateral (divisórias/prateleiras fixas), para contar cavilhas */
  juntasExtras?: number;
  /** peças tiradas pelo usuário: sem a lateral, o fundo encolhe para não sobrar para fora */
  removidas?: Set<string>;
};

export type Caixa = {
  pecas: Peca[];
  e: number;
  /** z de trás das laterais e z da frente */
  zb: number;
  P: number;
  /** z onde começa o espaço interno (depois do fundo embutido) */
  zInt: number;
  /** vão interno */
  xi0: number;
  xi1: number;
  yi0: number;
  yi1: number;
  /** y da parte de baixo do corpo (acima do rodapé) */
  yBase: number;
  lateralEsq: Peca;
  lateralDir: Peca;
};

/**
 * Corpo padrão: 2 laterais, tampo, base, fundo e rodapé opcional.
 * Coordenadas: x centrado, y = 0 no chão, z = 0 atrás, frente em z = P.
 */
export function montarCaixa(o: OpcoesCaixa): Caixa {
  const { L, A, P, chapa, fita } = o;
  const e = chapa.espessura;
  const tampoSobre = o.montagem === 'tampo_sobre';
  const rodape = tampoSobre ? 0 : Math.max(0, o.rodape ?? 0);
  const tF = o.fundo?.espessura ?? 0;
  const pregado = !!o.fundo && !o.fundoEmbutido;
  const embutido = !!o.fundo && o.fundoEmbutido;
  const zb = pregado ? tF : 0;
  const Pb = P - zb;
  const x0 = -L / 2;
  const x1 = L / 2;
  const yBase = rodape;
  const cav = 2 * (2 + (o.juntasExtras ?? 0));

  const yLat0 = tampoSobre ? e : 0;
  const yLat1 = tampoSobre ? A - e : A;
  const bordasLat = bordas(fita, { c1: true, l1: !tampoSobre, l2: !tampoSobre });
  const lateral = (id: string, nome: string, xa: number) =>
    peca({ id, nome, papel: 'lateral', chapa, comprimento: yLat1 - yLat0, largura: Pb, bordas: bordasLat, furos: [{ tipo: 'cavilha_8', quantidade: cav }], box3d: caixa(xa, xa + e, yLat0, yLat1, zb, P) });
  const lateralEsq = lateral('lateral-esq', 'Lateral esquerda', x0);
  const lateralDir = lateral('lateral-dir', 'Lateral direita', x1 - e);

  const hx0 = tampoSobre ? x0 : x0 + e;
  const hx1 = tampoSobre ? x1 : x1 - e;
  const bordasH = bordas(fita, { c1: true, l1: tampoSobre, l2: tampoSobre });
  const horizontal = (id: string, nome: string, papel: Papel, y: number) =>
    peca({ id, nome, papel, chapa, comprimento: hx1 - hx0, largura: Pb, bordas: bordasH, furos: [{ tipo: 'cavilha_8', quantidade: 4 }], box3d: caixa(hx0, hx1, y, y + e, zb, P) });

  const pecas: Peca[] = [lateralEsq, lateralDir, horizontal('tampo', 'Tampo', 'tampo', A - e), horizontal('base', 'Base', 'base', yBase)];

  if (rodape > 0) {
    const recuo = 30;
    pecas.push(
      peca({ id: 'rodape', nome: 'Rodapé', papel: 'outro', chapa, comprimento: L - 2 * e, largura: rodape, bordas: bordas(fita, { c1: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 }], box3d: caixa(x0 + e, x1 - e, 0, rodape, P - recuo - e, P - recuo) }),
    );
  }

  if (o.fundo) {
    const f = o.fundo;
    const fx0 = o.removidas?.has('lateral-esq') ? x0 + e : x0 + 2;
    const fx1 = o.removidas?.has('lateral-dir') ? x1 - e : x1 - 2;
    pecas.push(
      pregado
        ? peca({ id: 'fundo', nome: 'Fundo', papel: 'fundo', chapa: f, comprimento: A - yBase - 4, largura: fx1 - fx0, box3d: caixa(fx0, fx1, yBase + 2, A - 2, 0, tF) })
        : peca({ id: 'fundo', nome: 'Fundo', papel: 'fundo', chapa: f, comprimento: A - yBase - 2 * e, largura: L - 2 * e, box3d: caixa(x0 + e, x1 - e, yBase + e, A - e, 0, tF) }),
    );
  }

  return { pecas, e, zb, P, zInt: zb + (embutido ? tF : 0), xi0: x0 + e, xi1: x1 - e, yi0: yBase + e, yi1: A - e, yBase, lateralEsq, lateralDir };
}

export const chapaPorId = (catalogo: Catalogo, id: string) => catalogo.chapas.find((c) => c.id === id) ?? catalogo.chapas[0];
export const fitaPorId = (catalogo: Catalogo, id: string) => catalogo.fitas.find((f) => f.id === id)?.id ?? catalogo.fitas[0]?.id ?? null;

/** n prateleiras igualmente espaçadas num vão; devolve o y de baixo de cada uma */
export function distribuir(y0: number, y1: number, n: number, e: number): number[] {
  const vao = (y1 - y0 - n * e) / (n + 1);
  return Array.from({ length: n }, (_, k) => y0 + (k + 1) * vao + k * e);
}
