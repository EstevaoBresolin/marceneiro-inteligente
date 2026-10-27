import type { Orientacao } from '../domain/types';
import { bordas, caixa, chapaPorId, fitaPorId, peca } from './comum';
import { bool, num, str, type Template } from './types';

export const prateleira: Template = {
  id: 'prateleira',
  nome: 'Prateleira simples',
  descricao: 'Tábua com suporte oculto, opcional rebaixo para fita LED.',
  categoria: 'Peças',
  horasSugeridas: 0.3,
  parametros: [
    { id: 'comprimento', label: 'Comprimento', tipo: 'numero', padrao: 600, unidade: 'mm', min: 100, max: 2700, passo: 10 },
    { id: 'profundidade', label: 'Profundidade', tipo: 'numero', padrao: 200, unidade: 'mm', min: 60, max: 600, passo: 5 },
    { id: 'chapaId', label: 'Chapa', tipo: 'chapa', padrao: 'mdf-branco-18' },
    { id: 'rebaixoLed', label: 'Rebaixo para fita LED', tipo: 'booleano', padrao: false, dica: 'Vai como observação de usinagem.' },
    { id: 'fitaId', label: 'Fita de borda', tipo: 'fita', padrao: 'fita-branca-22', avancado: true },
  ],
  gerar(p, { catalogo }) {
    const chapa = chapaPorId(catalogo, str(p, 'chapaId'));
    const C = num(p, 'comprimento');
    const P = num(p, 'profundidade');
    return {
      pecas: [
        peca({
          id: 'prateleira',
          nome: bool(p, 'rebaixoLed') ? 'Prateleira (rebaixo LED)' : 'Prateleira',
          papel: 'prateleira',
          chapa,
          comprimento: C,
          largura: P,
          bordas: bordas(fitaPorId(catalogo, str(p, 'fitaId')), { c1: true, l1: true, l2: true }),
          furos: [{ tipo: 'outro', quantidade: 2 }],
          box3d: caixa(-C / 2, C / 2, 0, chapa.espessura, 0, P),
        }),
      ],
      ferragens: [{ ferragemId: 'parafuso-4x40', quantidade: 4 }],
      extras: [],
      dimensoes: { largura: C, altura: chapa.espessura, profundidade: P },
    };
  },
};

export const suporteMonitor: Template = {
  id: 'suporte-monitor',
  nome: 'Suporte de monitor (U)',
  descricao: 'Tampo apoiado sobre dois pés.',
  categoria: 'Peças',
  horasSugeridas: 0.4,
  parametros: [
    { id: 'comprimento', label: 'Comprimento', tipo: 'numero', padrao: 400, unidade: 'mm', min: 200, max: 1500, passo: 10 },
    { id: 'profundidade', label: 'Profundidade', tipo: 'numero', padrao: 200, unidade: 'mm', min: 100, max: 500, passo: 5 },
    { id: 'altura', label: 'Altura', tipo: 'numero', padrao: 80, unidade: 'mm', min: 40, max: 300, passo: 5 },
    { id: 'chapaId', label: 'Chapa', tipo: 'chapa', padrao: 'mdf-branco-18' },
    { id: 'fitaId', label: 'Fita de borda', tipo: 'fita', padrao: 'fita-branca-22', avancado: true },
  ],
  gerar(p, { catalogo }) {
    const chapa = chapaPorId(catalogo, str(p, 'chapaId'));
    const e = chapa.espessura;
    const C = num(p, 'comprimento');
    const P = num(p, 'profundidade');
    const H = num(p, 'altura');
    const fita = fitaPorId(catalogo, str(p, 'fitaId'));
    const pe = (id: string, nome: string, xa: number) =>
      peca({ id, nome, papel: 'lateral', chapa, comprimento: P, largura: H - e, bordas: bordas(fita, { c1: true, l1: true, l2: true }), furos: [{ tipo: 'cavilha_8', quantidade: 2 }], box3d: caixa(xa, xa + e, 0, H - e, 0, P) });
    return {
      pecas: [
        peca({ id: 'tampo', nome: 'Tampo', papel: 'tampo', chapa, comprimento: C, largura: P, bordas: bordas(fita, { c1: true, c2: true, l1: true, l2: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 }], box3d: caixa(-C / 2, C / 2, H - e, H, 0, P) }),
        pe('pe-esq', 'Pé esquerdo', -C / 2),
        pe('pe-dir', 'Pé direito', C / 2 - e),
      ],
      ferragens: [],
      extras: [],
      dimensoes: { largura: C, altura: H, profundidade: P },
    };
  },
};

/** caixa 3D de uma tábua conforme a orientação; centro em mm */
export function boxDaTabua(comprimento: number, largura: number, e: number, orientacao: Orientacao, centro: [number, number, number]) {
  const [cx, cy, cz] = centro;
  const tam: [number, number, number] =
    orientacao === 'horizontal' ? [comprimento, e, largura] : orientacao === 'lateral' ? [e, comprimento, largura] : [largura, comprimento, e];
  return caixa(cx - tam[0] / 2, cx + tam[0] / 2, cy - tam[1] / 2, cy + tam[1] / 2, cz - tam[2] / 2, cz + tam[2] / 2);
}

export const painel: Template = {
  id: 'painel',
  nome: 'Painel / tampo avulso',
  descricao: 'Uma tábua só, deitada ou em pé: tampo por cima de módulos, costas, lateral de acabamento.',
  categoria: 'Peças',
  horasSugeridas: 0.2,
  parametros: [
    { id: 'comprimento', label: 'Comprimento', tipo: 'numero', padrao: 900, unidade: 'mm', min: 50, max: 2750, passo: 10 },
    { id: 'largura', label: 'Largura', tipo: 'numero', padrao: 350, unidade: 'mm', min: 30, max: 1850, passo: 5 },
    { id: 'chapaId', label: 'Chapa', tipo: 'chapa', padrao: 'mdf-branco-18' },
    {
      id: 'orientacao',
      label: 'Posição',
      tipo: 'opcoes',
      padrao: 'horizontal',
      opcoes: [
        { valor: 'horizontal', label: 'Deitada (tampo)' },
        { valor: 'lateral', label: 'Em pé, de lado' },
        { valor: 'frontal', label: 'Em pé, de frente' },
      ],
    },
    {
      id: 'fita',
      label: 'Fita',
      tipo: 'opcoes',
      padrao: 'frente',
      opcoes: [
        { valor: 'nenhuma', label: 'Sem fita' },
        { valor: 'frente', label: 'Só na frente' },
        { valor: 'tres', label: 'Frente e pontas' },
        { valor: 'todas', label: '4 lados' },
      ],
    },
    { id: 'fitaId', label: 'Fita de borda', tipo: 'fita', padrao: 'fita-branca-22', avancado: true },
  ],
  gerar(p, { catalogo }) {
    const chapa = chapaPorId(catalogo, str(p, 'chapaId'));
    const e = chapa.espessura;
    const C = num(p, 'comprimento');
    const W = num(p, 'largura');
    const o = (str(p, 'orientacao') || 'horizontal') as Orientacao;
    const lados = str(p, 'fita');
    const fita = fitaPorId(catalogo, str(p, 'fitaId'));
    const b = bordas(fita, { c1: lados !== 'nenhuma', c2: lados === 'todas', l1: lados === 'tres' || lados === 'todas', l2: lados === 'tres' || lados === 'todas' });
    // centro de forma que a peça fique apoiada no chão e encostada atrás
    const box = boxDaTabua(C, W, e, o, [0, 0, 0]);
    const centro: [number, number, number] = [0, box.size[1] / 2, box.size[2] / 2];
    return {
      pecas: [peca({ id: 'painel', nome: o === 'horizontal' ? 'Tampo' : 'Painel', papel: o === 'horizontal' ? 'tampo' : 'lateral', chapa, comprimento: C, largura: W, bordas: b, box3d: boxDaTabua(C, W, e, o, centro) })],
      ferragens: [],
      extras: [],
      dimensoes: { largura: box.size[0], altura: box.size[1], profundidade: box.size[2] },
    };
  },
};

export const livre: Template = {
  id: 'livre',
  nome: 'Lista livre de peças',
  descricao: 'Sem 3D: só uma tabela de peças para o plano de corte e o orçamento.',
  horasSugeridas: 0,
  parametros: [],
  gerar: () => ({ pecas: [], ferragens: [], extras: [], dimensoes: { largura: 0, altura: 0, profundidade: 0 } }),
};
