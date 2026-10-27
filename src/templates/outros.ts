import type { Peca } from '../domain/types';
import { bordas, caixa, semBorda } from './comum';
import { bool, num, str, type Template } from './types';

export const nicho: Template = {
  id: 'nicho',
  nome: 'Nicho / caixa aberta',
  descricao: 'Caixa aberta na frente, com prateleiras opcionais.',
  horasSugeridas: 0.75,
  parametros: [
    { id: 'largura', label: 'Largura', tipo: 'numero', padrao: 400, unidade: 'mm', min: 100, max: 2000, passo: 10 },
    { id: 'altura', label: 'Altura', tipo: 'numero', padrao: 300, unidade: 'mm', min: 100, max: 2000, passo: 10 },
    { id: 'profundidade', label: 'Profundidade', tipo: 'numero', padrao: 200, unidade: 'mm', min: 60, max: 600, passo: 5 },
    { id: 'chapaId', label: 'Chapa', tipo: 'chapa', padrao: 'mdf-branco-15' },
    { id: 'prateleiras', label: 'Prateleiras', tipo: 'numero', padrao: 1, min: 0, max: 6, passo: 1, dica: '1 prateleira = 2 andares.' },
    { id: 'fundo', label: 'Fundo em HDF 3mm', tipo: 'booleano', padrao: true },
    { id: 'fitaId', label: 'Fita de borda', tipo: 'fita', padrao: 'fita-branca-22', avancado: true },
  ],
  gerar(p, { catalogo }) {
    const chapa = catalogo.chapas.find((c) => c.id === str(p, 'chapaId')) ?? catalogo.chapas[0];
    const e = chapa.espessura;
    const L = num(p, 'largura');
    const A = num(p, 'altura');
    const P = num(p, 'profundidade');
    const n = Math.round(num(p, 'prateleiras'));
    const fita = str(p, 'fitaId') || null;
    const girar = !chapa.temVeio;
    const hdf = bool(p, 'fundo') ? catalogo.chapas.find((c) => c.id === 'hdf-branco-3') : undefined;
    const tF = hdf?.espessura ?? 0;
    const Pb = P - tF;
    const x0 = -L / 2;
    const x1 = L / 2;
    const pecas: Peca[] = [
      { id: 'lateral', nome: 'Lateral', papel: 'lateral', chapaId: chapa.id, comprimento: A, largura: Pb, quantidade: 2, podeGirar: girar, bordas: bordas(fita, { c1: true, l1: true, l2: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 + 4 * n }], box3d: caixa(x0, x0 + e, 0, A, tF, P) },
      { id: 'lateral#2', nome: 'Lateral', papel: 'lateral', chapaId: chapa.id, comprimento: A, largura: Pb, quantidade: 0, podeGirar: girar, bordas: { ...semBorda }, furos: [], somente3d: true, box3d: caixa(x1 - e, x1, 0, A, tF, P) },
      { id: 'tampo', nome: 'Tampo', papel: 'tampo', chapaId: chapa.id, comprimento: L - 2 * e, largura: Pb, quantidade: 1, podeGirar: girar, bordas: bordas(fita, { c1: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 }], box3d: caixa(x0 + e, x1 - e, A - e, A, tF, P) },
      { id: 'base', nome: 'Base', papel: 'base', chapaId: chapa.id, comprimento: L - 2 * e, largura: Pb, quantidade: 1, podeGirar: girar, bordas: bordas(fita, { c1: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 }], box3d: caixa(x0 + e, x1 - e, 0, e, tF, P) },
    ];
    if (n > 0) {
      const vao = (A - 2 * e - n * e) / (n + 1);
      for (let k = 1; k <= n; k++) {
        const y = e + k * vao + (k - 1) * e;
        pecas.push({ id: k === 1 ? 'prateleira' : `prateleira#${k}`, nome: 'Prateleira', papel: 'prateleira', chapaId: chapa.id, comprimento: L - 2 * e, largura: Pb, quantidade: k === 1 ? n : 0, podeGirar: girar, bordas: bordas(fita, { c1: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 }], somente3d: k > 1, box3d: caixa(x0 + e, x1 - e, y, y + e, tF, P) });
      }
    }
    if (hdf) pecas.push({ id: 'fundo', nome: 'Fundo', papel: 'fundo', chapaId: hdf.id, comprimento: A - 4, largura: L - 4, quantidade: 1, podeGirar: true, bordas: { ...semBorda }, furos: [], box3d: caixa(x0 + 2, x1 - 2, 2, A - 2, 0, tF) });
    return {
      pecas,
      ferragens: [{ ferragemId: 'parafuso-4x40', quantidade: hdf ? 16 : 8 }, { ferragemId: 'suporte-parede', quantidade: 1 }],
      extras: [],
      dimensoes: { largura: L, altura: A, profundidade: P },
    };
  },
};

export const prateleira: Template = {
  id: 'prateleira',
  nome: 'Prateleira simples',
  descricao: 'Tábua com suporte oculto, opcional rebaixo para fita LED.',
  horasSugeridas: 0.3,
  parametros: [
    { id: 'comprimento', label: 'Comprimento', tipo: 'numero', padrao: 600, unidade: 'mm', min: 100, max: 2700, passo: 10 },
    { id: 'profundidade', label: 'Profundidade', tipo: 'numero', padrao: 200, unidade: 'mm', min: 60, max: 600, passo: 5 },
    { id: 'chapaId', label: 'Chapa', tipo: 'chapa', padrao: 'mdf-branco-18' },
    { id: 'rebaixoLed', label: 'Rebaixo para fita LED', tipo: 'booleano', padrao: false, dica: 'Vai como observação de usinagem.' },
    { id: 'fitaId', label: 'Fita de borda', tipo: 'fita', padrao: 'fita-branca-22', avancado: true },
  ],
  gerar(p, { catalogo }) {
    const chapa = catalogo.chapas.find((c) => c.id === str(p, 'chapaId')) ?? catalogo.chapas[0];
    const e = chapa.espessura;
    const C = num(p, 'comprimento');
    const P = num(p, 'profundidade');
    const fita = str(p, 'fitaId') || null;
    return {
      pecas: [
        {
          id: 'prateleira',
          nome: bool(p, 'rebaixoLed') ? 'Prateleira (rebaixo LED)' : 'Prateleira',
          papel: 'prateleira',
          chapaId: chapa.id,
          comprimento: C,
          largura: P,
          quantidade: 1,
          podeGirar: !chapa.temVeio,
          bordas: bordas(fita, { c1: true, l1: true, l2: true }),
          furos: [{ tipo: 'outro', quantidade: 2 }],
          box3d: caixa(-C / 2, C / 2, 0, e, 0, P),
        },
      ],
      ferragens: [{ ferragemId: 'parafuso-4x40', quantidade: 4 }],
      extras: [],
      dimensoes: { largura: C, altura: e, profundidade: P },
    };
  },
};

export const suporteMonitor: Template = {
  id: 'suporte-monitor',
  nome: 'Suporte de monitor (U)',
  descricao: 'Tampo apoiado sobre dois pés.',
  horasSugeridas: 0.4,
  parametros: [
    { id: 'comprimento', label: 'Comprimento', tipo: 'numero', padrao: 400, unidade: 'mm', min: 200, max: 1500, passo: 10 },
    { id: 'profundidade', label: 'Profundidade', tipo: 'numero', padrao: 200, unidade: 'mm', min: 100, max: 500, passo: 5 },
    { id: 'altura', label: 'Altura', tipo: 'numero', padrao: 80, unidade: 'mm', min: 40, max: 300, passo: 5 },
    { id: 'chapaId', label: 'Chapa', tipo: 'chapa', padrao: 'mdf-branco-18' },
    { id: 'fitaId', label: 'Fita de borda', tipo: 'fita', padrao: 'fita-branca-22', avancado: true },
  ],
  gerar(p, { catalogo }) {
    const chapa = catalogo.chapas.find((c) => c.id === str(p, 'chapaId')) ?? catalogo.chapas[0];
    const e = chapa.espessura;
    const C = num(p, 'comprimento');
    const P = num(p, 'profundidade');
    const H = num(p, 'altura');
    const fita = str(p, 'fitaId') || null;
    const girar = !chapa.temVeio;
    return {
      pecas: [
        { id: 'tampo', nome: 'Tampo', papel: 'tampo', chapaId: chapa.id, comprimento: C, largura: P, quantidade: 1, podeGirar: girar, bordas: bordas(fita, { c1: true, c2: true, l1: true, l2: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 }], box3d: caixa(-C / 2, C / 2, H - e, H, 0, P) },
        { id: 'pe', nome: 'Pé', papel: 'lateral', chapaId: chapa.id, comprimento: P, largura: H - e, quantidade: 2, podeGirar: girar, bordas: bordas(fita, { c1: true, l1: true, l2: true }), furos: [{ tipo: 'cavilha_8', quantidade: 2 }], box3d: caixa(-C / 2, -C / 2 + e, 0, H - e, 0, P) },
        { id: 'pe#2', nome: 'Pé', papel: 'lateral', chapaId: chapa.id, comprimento: P, largura: H - e, quantidade: 0, podeGirar: girar, bordas: { ...semBorda }, furos: [], somente3d: true, box3d: caixa(C / 2 - e, C / 2, 0, H - e, 0, P) },
      ],
      ferragens: [],
      extras: [],
      dimensoes: { largura: C, altura: H, profundidade: P },
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
