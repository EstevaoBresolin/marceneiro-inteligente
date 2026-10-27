import type { ConfigVenda } from '../domain/types';

export type Venda = {
  precoCentavos: number;
  comissaoCentavos: number;
  impostoCentavos: number;
  taxaFixaCentavos: number;
  freteCentavos: number;
  custoCentavos: number;
  lucroCentavos: number;
  /** margem líquida sobre o preço de venda, % */
  margemPercent: number;
};

/**
 * Preço P tal que: P − P·(comissão + imposto) − taxa fixa − frete − custo = P·margem
 *  ⇒ P = (custo + taxa fixa + frete) / (1 − comissão − imposto − margem)
 * Retorna null se os percentuais somam 100% ou mais (impossível).
 */
export function precoSugerido(custoCentavos: number, v: ConfigVenda): number | null {
  const pct = (v.comissaoMarketplacePercent + v.impostoPercent + v.margemDesejadaPercent) / 100;
  if (pct >= 1) return null;
  // arredonda para cima, ao centavo
  return Math.ceil((custoCentavos + v.taxaFixaCentavos + v.freteCentavos) / (1 - pct));
}

/** "Se eu vender por R$ X": quanto sobra de verdade */
export function simularVenda(precoCentavos: number, custoCentavos: number, v: ConfigVenda): Venda {
  const comissaoCentavos = Math.round((precoCentavos * v.comissaoMarketplacePercent) / 100);
  const impostoCentavos = Math.round((precoCentavos * v.impostoPercent) / 100);
  const lucroCentavos = precoCentavos - comissaoCentavos - impostoCentavos - v.taxaFixaCentavos - v.freteCentavos - custoCentavos;
  return {
    precoCentavos,
    comissaoCentavos,
    impostoCentavos,
    taxaFixaCentavos: v.taxaFixaCentavos,
    freteCentavos: v.freteCentavos,
    custoCentavos,
    lucroCentavos,
    margemPercent: precoCentavos > 0 ? (lucroCentavos / precoCentavos) * 100 : 0,
  };
}
