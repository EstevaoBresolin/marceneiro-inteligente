/**
 * Empacotador guilhotina (baseado em Jylänki, "A Thousand Ways to Pack the Bin").
 *
 * Truque do kerf: cada peça é tratada como (w + kerf) × (h + kerf) e a área útil
 * como (W + kerf) × (H + kerf). Assim o espaço entre peças é exatamente o kerf e
 * as peças podem encostar na borda da área útil. Cada espaço livre sempre carrega
 * o kerf na sua borda direita/inferior, então a sobra real é (fw − kerf) × (fh − kerf).
 *
 * Os espaços livres nunca são fundidos: toda divisão é um corte de ponta a ponta do
 * espaço que está sendo dividido, o que garante que o layout é guilhotinável e que a
 * ordem em que os cortes são registrados é uma sequência executável na serra.
 */
import type { Corte, PecaCorte, Retangulo } from './types';

export type EscolhaEspaco = 'BAF' | 'BSSF' | 'BLSF';
export type RegraDivisao = 'SLAS' | 'LLAS' | 'MINAS' | 'MAXAS' | 'SAS' | 'LAS';
export type EscolhaChapa = 'global' | 'primeira';

export type Parametros = {
  escolha: EscolhaEspaco;
  divisao: RegraDivisao;
  chapaSel: EscolhaChapa;
};

type Livre = { x: number; y: number; w: number; h: number };

export type Colocada = {
  peca: PecaCorte;
  x: number;
  y: number;
  w: number; // real
  h: number; // real
  rotacionada: boolean;
};

export type ChapaPack = {
  livres: Livre[];
  colocadas: Colocada[];
  cortes: Omit<Corte, 'ordem'>[];
};

export type Pack = {
  chapas: ChapaPack[];
  naoCabem: PecaCorte[];
};

function pontuar(escolha: EscolhaEspaco, f: Livre, w: number, h: number): [number, number] {
  const sobraW = f.w - w;
  const sobraH = f.h - h;
  const areaSobra = f.w * f.h - w * h;
  const curto = Math.min(sobraW, sobraH);
  const longo = Math.max(sobraW, sobraH);
  switch (escolha) {
    case 'BAF':
      return [areaSobra, curto];
    case 'BSSF':
      return [curto, longo];
    case 'BLSF':
      return [longo, curto];
  }
}

function dividirHorizontal(regra: RegraDivisao, f: Livre, w: number, h: number): boolean {
  const sobraW = f.w - w;
  const sobraH = f.h - h;
  switch (regra) {
    case 'SLAS':
      return sobraW <= sobraH;
    case 'LLAS':
      return sobraW > sobraH;
    case 'MINAS':
      return w * sobraH > sobraW * h;
    case 'MAXAS':
      return w * sobraH <= sobraW * h;
    case 'SAS':
      return f.w <= f.h;
    case 'LAS':
      return f.w > f.h;
  }
}

function menor(a: [number, number], b: [number, number]) {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
}

/**
 * Empacota as peças na ordem dada.
 * @param W largura útil (já sem refilo), @param H altura útil
 * Coordenadas retornadas são relativas ao canto da área útil.
 */
export function empacotar(pecas: PecaCorte[], W: number, H: number, kerf: number, p: Parametros): Pack {
  const WK = W + kerf;
  const HK = H + kerf;
  const chapas: ChapaPack[] = [];
  const naoCabem: PecaCorte[] = [];

  const novaChapa = (): ChapaPack => ({ livres: [{ x: 0, y: 0, w: WK, h: HK }], colocadas: [], cortes: [] });

  for (const peca of pecas) {
    const wk = peca.w + kerf;
    const hk = peca.h + kerf;
    const cabeNormal = wk <= WK && hk <= HK;
    const cabeGirada = peca.podeGirar && hk <= WK && wk <= HK;
    if (!cabeNormal && !cabeGirada) {
      naoCabem.push(peca);
      continue;
    }

    let melhor: { ci: number; li: number; rot: boolean; score: [number, number] } | null = null;

    const avaliarChapa = (ci: number) => {
      const ch = chapas[ci];
      for (let li = 0; li < ch.livres.length; li++) {
        const f = ch.livres[li];
        if (wk <= f.w && hk <= f.h) {
          const s = pontuar(p.escolha, f, wk, hk);
          if (!melhor || menor(s, melhor.score)) melhor = { ci, li, rot: false, score: s };
        }
        if (peca.podeGirar && peca.w !== peca.h && hk <= f.w && wk <= f.h) {
          const s = pontuar(p.escolha, f, hk, wk);
          if (!melhor || menor(s, melhor.score)) melhor = { ci, li, rot: true, score: s };
        }
      }
    };

    for (let ci = 0; ci < chapas.length; ci++) {
      avaliarChapa(ci);
      if (p.chapaSel === 'primeira' && melhor) break;
    }

    if (!melhor) {
      chapas.push(novaChapa());
      avaliarChapa(chapas.length - 1);
    }
    if (!melhor) {
      naoCabem.push(peca);
      continue;
    }

    const m = melhor as { ci: number; li: number; rot: boolean };
    const ch = chapas[m.ci];
    const f = ch.livres[m.li];
    const pw = m.rot ? hk : wk;
    const ph = m.rot ? wk : hk;

    ch.colocadas.push({ peca, x: f.x, y: f.y, w: pw - kerf, h: ph - kerf, rotacionada: m.rot });
    ch.livres.splice(m.li, 1);

    const sobraW = f.w - pw;
    const sobraH = f.h - ph;
    const horizontal = dividirHorizontal(p.divisao, f, pw, ph);

    // horizontal: 1º corte atravessa toda a largura de f; o espaço de baixo fica com a largura inteira
    let baixo: Livre;
    let direita: Livre;
    if (horizontal) {
      baixo = { x: f.x, y: f.y + ph, w: f.w, h: sobraH };
      direita = { x: f.x + pw, y: f.y, w: sobraW, h: ph };
      if (sobraH > 0) ch.cortes.push({ direcao: 'horizontal', x: f.x, y: f.y + ph - kerf, comprimento: f.w - kerf });
      if (sobraW > 0) ch.cortes.push({ direcao: 'vertical', x: f.x + pw - kerf, y: f.y, comprimento: ph - kerf });
    } else {
      baixo = { x: f.x, y: f.y + ph, w: pw, h: sobraH };
      direita = { x: f.x + pw, y: f.y, w: sobraW, h: f.h };
      if (sobraW > 0) ch.cortes.push({ direcao: 'vertical', x: f.x + pw - kerf, y: f.y, comprimento: f.h - kerf });
      if (sobraH > 0) ch.cortes.push({ direcao: 'horizontal', x: f.x, y: f.y + ph - kerf, comprimento: pw - kerf });
    }
    // só guarda espaços onde caberia ao menos 1mm de material real
    if (baixo.w > kerf && baixo.h > kerf) ch.livres.push(baixo);
    if (direita.w > kerf && direita.h > kerf) ch.livres.push(direita);
  }

  return { chapas, naoCabem };
}

/** Converte espaço livre (com kerf embutido) em sobra real */
export function sobraReal(f: Retangulo, kerf: number): Retangulo {
  return { x: f.x, y: f.y, w: f.w - kerf, h: f.h - kerf };
}
