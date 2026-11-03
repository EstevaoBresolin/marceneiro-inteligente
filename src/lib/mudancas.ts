/**
 * Avisos de mudança do store para a sincronização com a nuvem.
 * Fica separado para o store não depender do Supabase (e os testes rodarem sem rede).
 */
export type Mudanca = { projeto: string } | { perfil: true };

let ouvinte: ((m: Mudanca) => void) | null = null;

export function ouvirMudancas(fn: ((m: Mudanca) => void) | null) {
  ouvinte = fn;
}

export function mudou(m: Mudanca) {
  ouvinte?.(m);
}
