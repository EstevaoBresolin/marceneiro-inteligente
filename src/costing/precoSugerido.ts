import type { ConfigVenda } from '../domain/types';

export type Venda = {
  precoCentavos: number;
  impostoCentavos: number;
  comissaoCentavos: number;
  cartaoCentavos: number;
  custoCentavos: number;
  lucroCentavos: number;
  /** margem líquida sobre o preço de venda, % */
  margemPercent: number;
  /** quantas vezes o custo (markup) */
  markup: number;
};

const percentuais = (v: ConfigVenda) => (v.impostoPercent ?? 0) + (v.comissaoPercent ?? 0) + (v.taxaCartaoPercent ?? 0);

/**
 * Preço P tal que: P − P·(imposto + comissão + cartão) − custo = P·margem
 *  ⇒ P = custo / (1 − imposto − comissão − cartão − margem)
 * Retorna null se os percentuais somam 100% ou mais (impossível).
 */
export function precoSugerido(custoCentavos: number, v: ConfigVenda): number | null {
  const pct = (percentuais(v) + (v.margemDesejadaPercent ?? 0)) / 100;
  if (pct >= 1) return null;
  // arredonda para cima, ao centavo
  return Math.ceil(custoCentavos / (1 - pct));
}

/** "Se eu fechar por R$ X": quanto sobra de verdade */
export function simularVenda(precoCentavos: number, custoCentavos: number, v: ConfigVenda): Venda {
  const impostoCentavos = Math.round((precoCentavos * (v.impostoPercent ?? 0)) / 100);
  const comissaoCentavos = Math.round((precoCentavos * (v.comissaoPercent ?? 0)) / 100);
  const cartaoCentavos = Math.round((precoCentavos * (v.taxaCartaoPercent ?? 0)) / 100);
  const lucroCentavos = precoCentavos - impostoCentavos - comissaoCentavos - cartaoCentavos - custoCentavos;
  return {
    precoCentavos,
    impostoCentavos,
    comissaoCentavos,
    cartaoCentavos,
    custoCentavos,
    lucroCentavos,
    margemPercent: precoCentavos > 0 ? (lucroCentavos / precoCentavos) * 100 : 0,
    markup: custoCentavos > 0 ? precoCentavos / custoCentavos : 0,
  };
}

/** arredonda para um valor "redondo" de orçamento: R$ 10 até 1.000, R$ 50 até 10.000, R$ 100 acima */
export function arredondarPreco(centavos: number) {
  const passo = centavos <= 100_000 ? 1_000 : centavos <= 1_000_000 ? 5_000 : 10_000;
  return Math.ceil(centavos / passo) * passo;
}
