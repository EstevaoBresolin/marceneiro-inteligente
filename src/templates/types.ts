import type { Catalogo, Config, Extra, ItemFerragem, Peca } from '../domain/types';

export type Valor = number | boolean | string;
export type Params = Record<string, Valor>;

export type ParamDef = {
  id: string;
  label: string;
  tipo: 'numero' | 'opcoes' | 'booleano' | 'chapa' | 'fita';
  padrao: Valor;
  unidade?: string;
  min?: number;
  max?: number;
  passo?: number;
  opcoes?: { valor: string; label: string }[];
  /** fica escondido em "Avançado" */
  avancado?: boolean;
  /** só aparece quando a condição é verdadeira */
  mostrarSe?: (p: Params) => boolean;
  dica?: string;
};

export type ResultadoTemplate = {
  pecas: Peca[];
  ferragens: ItemFerragem[];
  extras: Extra[];
  /** caixa externa para cotas no 3D, mm */
  dimensoes: { largura: number; altura: number; profundidade: number };
};

export type Contexto = { catalogo: Catalogo; config: Config };

export type Template = {
  id: string;
  nome: string;
  descricao: string;
  parametros: ParamDef[];
  horasSugeridas: number;
  gerar(p: Params, ctx: Contexto): ResultadoTemplate;
  validar?(p: Params, ctx: Contexto): string[];
};

export const padroes = (t: Template): Params => Object.fromEntries(t.parametros.map((d) => [d.id, d.padrao]));

export const num = (p: Params, k: string) => Number(p[k]) || 0;
export const str = (p: Params, k: string) => String(p[k] ?? '');
export const bool = (p: Params, k: string) => p[k] === true || p[k] === 'true';
