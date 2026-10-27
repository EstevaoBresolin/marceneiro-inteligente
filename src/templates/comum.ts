import type { Box3d, Bordas } from '../domain/types';

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
