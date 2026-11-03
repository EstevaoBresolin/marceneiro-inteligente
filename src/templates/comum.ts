import type { Bordas, Box3d, Chapa, Catalogo, ItemFerragem, Papel, Peca, TipoFuro } from '../domain/types';

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

/** comprimentos comerciais de corrediça telescópica, mm */
export const CORREDICAS = [250, 300, 350, 400, 450, 500, 550, 600];

export type OpcoesGavetas = {
  /** prefixo do id: gaveta-1, gaveta-1-frente… */
  prefixo?: string;
  /** vão interno entre as peças que seguram a corrediça */
  xi0: number;
  xi1: number;
  /** faixa de altura ocupada pelas frentes */
  y0: number;
  y1: number;
  n: number;
  /** z da frente do corpo e z de trás disponível */
  zFrente: number;
  zFundo: number;
  chapa: Chapa;
  /** chapa das frentes (padrão: a do corpo) */
  chapaFrente?: Chapa;
  chapaG: Chapa;
  fundoG?: Chapa;
  fita: string | null;
  folgaFrente: number;
  folgaCorredica: number;
  puxador: boolean;
  /** sobreposta: frente cobre o corpo por fora (largura dada); interna: frente dentro do vão, recuada */
  modo: { tipo: 'sobreposta'; xa: number; xb: number } | { tipo: 'interna'; recuo: number };
};

/** Gavetas com corrediça telescópica: frente, caixa (2 laterais, contrafrente, traseira) e fundo. */
export function criarGavetas(o: OpcoesGavetas): { pecas: Peca[]; ferragens: ItemFerragem[] } {
  const g0 = o.prefixo ?? 'gaveta';
  const pecas: Peca[] = [];
  const ferragens: ItemFerragem[] = [];
  const cf = o.chapaFrente ?? o.chapa;
  const e = cf.espessura;
  const f = o.folgaFrente;
  const interna = o.modo.tipo === 'interna';
  const zFrenteExt = interna ? o.zFrente - (o.modo as { recuo: number }).recuo : o.zFrente + e;
  const zFrente0 = zFrenteExt - e;
  const profUtil = (interna ? zFrente0 : o.zFrente) - o.zFundo - 10;
  const corr = [...CORREDICAS].reverse().find((c) => c <= profUtil) ?? CORREDICAS[0];
  const hFrente = Math.floor((o.y1 - o.y0 - (o.n + (interna ? 1 : 0)) * f) / o.n);
  const [xa, xb] = o.modo.tipo === 'sobreposta' ? [o.modo.xa, o.modo.xb] : [o.xi0 + f, o.xi1 - f];
  const wFrente = Math.floor(xb - xa);
  const xm = (xa + xb) / 2;
  const eg = o.chapaG.espessura;
  const Wg = Math.floor(o.xi1 - o.xi0 - 2 * o.folgaCorredica);
  const xc = (o.xi0 + o.xi1) / 2;
  const hc = Math.max(60, hFrente - 40);
  const curso = Math.round(corr * 0.75);
  const tFundoG = o.fundoG?.espessura ?? 3;
  const zCaixa1 = interna ? zFrente0 : o.zFrente;

  for (let k = 0; k < o.n; k++) {
    const yF = o.y0 + (interna ? f : 0) + k * (hFrente + f) + (interna ? 0 : f / 2);
    const g = `${g0}-${k + 1}`;
    const frente = peca({
      id: `${g}-frente`,
      nome: `Frente da gaveta ${k + 1}`,
      papel: 'porta',
      chapa: cf,
      comprimento: wFrente,
      largura: hFrente,
      bordas: bordas(o.fita, { c1: true, c2: true, l1: true, l2: true }),
      furos: [{ tipo: 'puxador', quantidade: o.puxador ? 1 : 0 }, { tipo: 'parafuso', quantidade: 4 }],
      box3d: { ...caixa(xm - wFrente / 2, xm + wFrente / 2, yF, yF + hFrente, zFrente0, zFrenteExt), gaveta: curso },
    });
    pecas.push(frente);
    ferragens.push({ ferragemId: 'corredica-telescopica', quantidade: 1, pecaId: frente.id });
    if (o.puxador) ferragens.push({ ferragemId: 'puxador', quantidade: 1, pecaId: frente.id });

    const yc = yF + 20;
    const zc0 = zCaixa1 - corr;
    const xg0 = xc - Wg / 2;
    const xg1 = xc + Wg / 2;
    const sub = (id: string, nome: string, comprimento: number, largura: number, box: Box3d, c?: Chapa, b = false): Peca => ({
      ...peca({ id: `${g}-${id}`, nome: `Gaveta ${k + 1}: ${nome}`, papel: 'outro', chapa: c ?? o.chapaG, comprimento, largura, bordas: b ? bordas(o.fita, { c1: true }) : undefined, furos: c ? [] : [{ tipo: 'cavilha_8', quantidade: 2 }], box3d: { ...box, gaveta: curso } }),
      dependeDe: frente.id,
    });
    pecas.push(
      sub('lat-esq', 'lateral', corr, hc, caixa(xg0, xg0 + eg, yc, yc + hc, zc0, zCaixa1), undefined, true),
      sub('lat-dir', 'lateral', corr, hc, caixa(xg1 - eg, xg1, yc, yc + hc, zc0, zCaixa1), undefined, true),
      sub('contrafrente', 'contrafrente', Wg - 2 * eg, hc, caixa(xg0 + eg, xg1 - eg, yc, yc + hc, zCaixa1 - eg, zCaixa1)),
      sub('traseira', 'traseira', Wg - 2 * eg, hc, caixa(xg0 + eg, xg1 - eg, yc, yc + hc, zc0, zc0 + eg), undefined, true),
    );
    if (o.fundoG) pecas.push(sub('fundo', 'fundo', corr, Wg, caixa(xg0, xg1, yc - tFundoG, yc, zc0, zCaixa1), o.fundoG));
  }
  return { pecas, ferragens };
}

/** Peça só visual de metal (trilho, tubo): não entra no corte */
export function metal(id: string, nome: string, box: Box3d, dependeDe?: string): Peca {
  return { id, nome, chapaId: '', comprimento: Math.round(Math.max(...box.size)), largura: Math.round(Math.min(...box.size)), quantidade: 0, podeGirar: true, bordas: { ...semBorda }, furos: [], papel: 'metal', somente3d: true, box3d: box, dependeDe };
}
