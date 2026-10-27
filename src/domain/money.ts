const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const brl = (centavos: number) => fmt.format(centavos / 100);

/** Converte "12,50" / "12.50" / 12.5 em centavos inteiros */
export function paraCentavos(valor: string | number): number {
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export const reais = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',');

export const mm2paraM2 = (mm2: number) => mm2 / 1_000_000;

export const fmtNum = (n: number, casas = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const novoId = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
