import type { ChapaResultado, PecaPosicionada, ResultadoCorte } from './types';

/** Lista de problemas encontrados no resultado (vazia = válido) */
export function validarResultado(r: ResultadoCorte): string[] {
  const erros: string[] = [];
  const { chapa, kerf, refilo } = r;
  const x0 = refilo;
  const y0 = refilo;
  const x1 = chapa.largura - refilo;
  const y1 = chapa.altura - refilo;

  for (const ch of r.chapas) {
    for (const p of ch.pecas) {
      if (p.x < x0 || p.y < y0 || p.x + p.w > x1 || p.y + p.h > y1)
        erros.push(`chapa ${ch.indice + 1}: ${p.rotulo} sai da área útil`);
    }
    for (let i = 0; i < ch.pecas.length; i++)
      for (let j = i + 1; j < ch.pecas.length; j++) {
        const a = ch.pecas[i];
        const b = ch.pecas[j];
        const separadas =
          a.x + a.w + kerf <= b.x || b.x + b.w + kerf <= a.x || a.y + a.h + kerf <= b.y || b.y + b.h + kerf <= a.y;
        if (!separadas) erros.push(`chapa ${ch.indice + 1}: ${a.rotulo} e ${b.rotulo} se sobrepõem (ou sem kerf)`);
      }
    if (!guilhotinavel(ch)) erros.push(`chapa ${ch.indice + 1}: layout não é guilhotinável`);
  }
  return erros;
}

/** Existe sempre um corte de ponta a ponta que separa as peças em dois grupos, recursivamente? */
export function guilhotinavel(ch: Pick<ChapaResultado, 'pecas'>): boolean {
  return recursivo(ch.pecas);
}

function recursivo(pecas: PecaPosicionada[]): boolean {
  if (pecas.length <= 1) return true;
  for (const eixo of ['x', 'y'] as const) {
    const tam = eixo === 'x' ? 'w' : 'h';
    const posicoes = [...new Set(pecas.map((p) => p[eixo] + p[tam]))].sort((a, b) => a - b);
    for (const c of posicoes) {
      const antes = pecas.filter((p) => p[eixo] + p[tam] <= c);
      const depois = pecas.filter((p) => p[eixo] >= c);
      if (antes.length > 0 && depois.length > 0 && antes.length + depois.length === pecas.length)
        return recursivo(antes) && recursivo(depois);
    }
  }
  return false;
}
