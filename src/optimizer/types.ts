export type PecaCorte = {
  /** id da peça de origem (várias unidades compartilham o mesmo id) */
  pecaId: string;
  rotulo: string;
  /** comprimento (sentido do veio / eixo X da chapa), mm */
  w: number;
  /** largura (eixo Y da chapa), mm */
  h: number;
  podeGirar: boolean;
};

export type ChapaCorte = {
  id: string;
  nome: string;
  largura: number; // eixo X, mm
  altura: number; // eixo Y, mm
  temVeio: boolean;
  /** preço desta chapa (deste tamanho), centavos */
  precoCentavos?: number;
};

export type EntradaOtimizador = {
  pecas: PecaCorte[];
  chapa: ChapaCorte;
  kerf: number;
  refilo: number;
  /** orçamento de tempo para a busca, ms (padrão 1500) */
  tempoMs?: number;
  /** semente para reprodutibilidade */
  seed?: number;
};

export type PecaPosicionada = {
  pecaId: string;
  rotulo: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotacionada: boolean;
};

export type Retangulo = { x: number; y: number; w: number; h: number };

export type Corte = {
  ordem: number;
  direcao: 'horizontal' | 'vertical';
  /** ponto inicial do corte e comprimento, mm (coordenadas reais da chapa) */
  x: number;
  y: number;
  comprimento: number;
};

export type ChapaResultado = {
  indice: number;
  pecas: PecaPosicionada[];
  sobras: Retangulo[];
  cortes: Corte[];
  areaPecas: number;
  aproveitamento: number; // 0..1, sobre a chapa inteira
  metrosCorte: number;
};

export type ResultadoCorte = {
  chapa: ChapaCorte;
  kerf: number;
  refilo: number;
  chapas: ChapaResultado[];
  naoCabem: PecaCorte[];
  totalPecas: number;
  aproveitamentoMedio: number;
  metrosCorte: number;
  numCortes: number;
  areaSobra: number;
  maiorSobra: Retangulo | null;
  estrategia: string;
  iteracoes: number;
  /** quantos tamanhos de chapa foram comparados (quando mais de um) */
  alternativas?: number;
};
