// Unidades: medidas em milímetros (inteiros), dinheiro em centavos (inteiros).

export type Chapa = {
  id: string;
  nome: string;
  espessura: number;
  /** comprimento da chapa (lado maior), mm */
  largura: number;
  /** largura da chapa (lado menor), mm */
  altura: number;
  temVeio: boolean;
  precoCentavos: number;
  cor: string;
};

export type FitaBorda = {
  id: string;
  nome: string;
  largura: number;
  precoMetroCentavos: number;
};

export type Ferragem = {
  id: string;
  nome: string;
  unidade: 'un' | 'par' | 'm' | 'm2';
  precoCentavos: number;
};

export type TipoFuro = 'dobradica_35' | 'cavilha_8' | 'minifix' | 'parafuso' | 'puxador' | 'outro';

export const NOMES_FURO: Record<TipoFuro, string> = {
  dobradica_35: 'Caneco dobradiça 35mm',
  cavilha_8: 'Cavilha 8mm',
  minifix: 'Minifix',
  parafuso: 'Parafuso',
  puxador: 'Puxador',
  outro: 'Furo de pino / outro',
};

export type CorteModo = 'por_peca' | 'por_metro_linear' | 'por_chapa' | 'incluso';
export type ChapaCobranca = 'inteiras' | 'proporcional';

export type ServicoConfig = {
  corteModo: CorteModo;
  cortePrecoCentavos: number;
  coladeiraPrecoMetroCentavos: number;
  furoPrecos: Record<TipoFuro, number>;
  kerf: number;
  refilo: number;
  perdaFitaPercent: number;
  maoDeObraHoraCentavos: number;
  chapaCobranca: ChapaCobranca;
  perdaChapaPercent: number;
  espelhoM2Centavos: number;
};

export type ConfigVenda = {
  comissaoMarketplacePercent: number;
  taxaFixaCentavos: number;
  freteCentavos: number;
  impostoPercent: number;
  margemDesejadaPercent: number;
};

export type Catalogo = {
  chapas: Chapa[];
  fitas: FitaBorda[];
  ferragens: Ferragem[];
};

export type Config = {
  servico: ServicoConfig;
  venda: ConfigVenda;
};

export type Bordas = {
  /** lados no sentido do comprimento */
  c1: string | null;
  c2: string | null;
  /** lados no sentido da largura */
  l1: string | null;
  l2: string | null;
};

export type Papel = 'lateral' | 'tampo' | 'base' | 'prateleira' | 'fundo' | 'porta' | 'divisoria' | 'espelho' | 'outro';

export type Peca = {
  id: string;
  nome: string;
  chapaId: string;
  comprimento: number;
  largura: number;
  quantidade: number;
  podeGirar: boolean;
  bordas: Bordas;
  furos: { tipo: TipoFuro; quantidade: number }[];
  papel?: Papel;
  /** Peças só visuais (ex.: espelho) não entram no plano de corte */
  somente3d?: boolean;
  /** caixa 3D: centro e tamanho em mm (x = largura, y = altura, z = profundidade; frente = +z) */
  box3d?: Box3d;
  /** peça alterada à mão: o template não sobrescreve */
  editadaManualmente?: boolean;
  /** some junto quando a peça indicada é removida (ex.: espelho colado na porta) */
  dependeDe?: string;
  /** peça solta adicionada pelo usuário: o 3D sai daqui (centro em mm, relativo ao módulo) */
  livre3d?: { orientacao: Orientacao; centro: [number, number, number] };
};

/** horizontal = deitada (prateleira); lateral = em pé de lado; frontal = em pé de frente */
export type Orientacao = 'horizontal' | 'lateral' | 'frontal';

export type Box3d = {
  pos: [number, number, number];
  size: [number, number, number];
  /** eixo da dobradiça (para abrir a porta): x e z do eixo vertical, sinal do giro */
  dobradica?: { x: number; z: number; sinal: 1 | -1 };
  /** gaveta: quanto ela corre para a frente ao abrir, mm */
  gaveta?: number;
};

/** pecaId (opcional): se a peça for removida, o item sai junto (ex.: dobradiças da porta) */
export type ItemFerragem = { ferragemId: string; quantidade: number; pecaId?: string; moduloId?: string };
export type Extra = { descricao: string; custoCentavos: number; detalhe?: string; pecaId?: string };

/** Um móvel paramétrico dentro do projeto, posicionado no espaço (mm) */
export type Modulo = {
  id: string;
  nome: string;
  templateId: string;
  parametros: Record<string, number | boolean | string>;
  /** deslocamento da origem do módulo (centro embaixo, atrás), mm */
  posicao: [number, number, number];
  /** ids (locais) das peças que o usuário tirou */
  removidas?: string[];
  /** laterais tiradas automaticamente para usar a do vizinho, e quanto o módulo andou por isso */
  compartilhadas?: { peca: 'lateral-esq' | 'lateral-dir'; dx: number }[];
  /** peças movidas à mão: deslocamento em mm a partir de onde o template as coloca */
  deslocamentos?: Record<string, [number, number, number]>;
  /** peças soltas que o usuário adicionou neste módulo */
  pecasExtras?: Peca[];
};

export type Projeto = {
  id: string;
  nome: string;
  /** 'livre' = só lista de peças; qualquer outro = projeto composto por módulos */
  templateId: string;
  parametros: Record<string, number | boolean | string>;
  modulos?: Modulo[];
  /** módulos encostados dividem a lateral (padrão: sim) */
  compartilharLaterais?: boolean;
  pecas: Peca[];
  ferragens: ItemFerragem[];
  extras: Extra[];
  horasMaoDeObra: number;
  quantidadeLote: number;
  atualizadoEm: number;
};
