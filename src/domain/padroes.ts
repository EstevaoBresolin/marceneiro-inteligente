/**
 * Cores e padrões de MDF para o 3D. São aproximações genéricas (cor lisa ou madeira desenhada pelo
 * próprio sistema), não fotos de fornecedores: servem para o cliente ter ideia do acabamento.
 */
export type Padrao = {
  id: string;
  nome: string;
  tipo: 'liso' | 'madeira' | 'textura';
  /** cor de fundo */
  base: string;
  /** cor dos veios (madeira) ou das manchas (textura) */
  veio?: string;
  /** veios mais largos (1) ou finos (0.5) */
  escala?: number;
  /** liso fosco (0) a brilhante (1) */
  brilho?: number;
};

export const PADROES: Padrao[] = [
  { id: 'branco', nome: 'Branco', tipo: 'liso', base: '#f1efe9' },
  { id: 'branco-brilho', nome: 'Branco brilho', tipo: 'liso', base: '#f6f5f2', brilho: 0.8 },
  { id: 'off-white', nome: 'Off-white', tipo: 'liso', base: '#ece5d8' },
  { id: 'areia', nome: 'Areia', tipo: 'liso', base: '#d8cbb5' },
  { id: 'cinza-claro', nome: 'Cinza claro', tipo: 'liso', base: '#c9cbc8' },
  { id: 'grafite', nome: 'Grafite', tipo: 'liso', base: '#4a4d50' },
  { id: 'preto', nome: 'Preto', tipo: 'liso', base: '#26272a' },
  { id: 'verde-salvia', nome: 'Verde sálvia', tipo: 'liso', base: '#9aa58e' },
  { id: 'azul-petroleo', nome: 'Azul petróleo', tipo: 'liso', base: '#2f5562' },
  { id: 'terracota', nome: 'Terracota', tipo: 'liso', base: '#b46b4f' },
  { id: 'concreto', nome: 'Cimento', tipo: 'textura', base: '#a7a6a1', veio: '#8f8e89' },
  { id: 'carvalho-claro', nome: 'Carvalho claro', tipo: 'madeira', base: '#d9bf98', veio: '#b89568', escala: 0.8 },
  { id: 'carvalho-natural', nome: 'Carvalho natural', tipo: 'madeira', base: '#c49a6c', veio: '#9a6f45', escala: 0.9 },
  { id: 'freijo', nome: 'Freijó', tipo: 'madeira', base: '#b98c5e', veio: '#8c6239', escala: 1 },
  { id: 'nogueira', nome: 'Nogueira', tipo: 'madeira', base: '#7a5539', veio: '#4f3422', escala: 1.1 },
  { id: 'cumaru', nome: 'Cumaru', tipo: 'madeira', base: '#9c6b45', veio: '#6d4428', escala: 0.6 },
  { id: 'pinus', nome: 'Pinus', tipo: 'madeira', base: '#e2c493', veio: '#c79b5c', escala: 1.3 },
  { id: 'madeira-cinza', nome: 'Madeira acinzentada', tipo: 'madeira', base: '#a8a097', veio: '#7e766c', escala: 0.9 },
];

export const padraoPorId = (id?: string) => PADROES.find((p) => p.id === id);
