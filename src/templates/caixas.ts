import type { Peca } from '../domain/types';
import { bordas, caixa, chapaPorId, distribuir, fitaPorId, montarCaixa, peca } from './comum';
import { bool, num, str, type Template } from './types';

export const nicho: Template = {
  id: 'nicho',
  nome: 'Nicho / caixa aberta',
  descricao: 'Caixa aberta na frente, com prateleiras fixas.',
  categoria: 'Caixas e estantes',
  horasSugeridas: 0.75,
  parametros: [
    { id: 'largura', label: 'Largura', tipo: 'numero', padrao: 400, unidade: 'mm', min: 100, max: 2400, passo: 10 },
    { id: 'altura', label: 'Altura', tipo: 'numero', padrao: 300, unidade: 'mm', min: 100, max: 2400, passo: 10 },
    { id: 'profundidade', label: 'Profundidade', tipo: 'numero', padrao: 200, unidade: 'mm', min: 60, max: 650, passo: 5 },
    { id: 'chapaId', label: 'Chapa', tipo: 'chapa', padrao: 'mdf-branco-15' },
    { id: 'prateleiras', label: 'Prateleiras', tipo: 'numero', padrao: 1, min: 0, max: 8, passo: 1, dica: '1 prateleira = 2 andares.' },
    { id: 'fundo', label: 'Fundo em HDF 3mm', tipo: 'booleano', padrao: true },
    { id: 'fitaId', label: 'Fita de borda', tipo: 'fita', padrao: 'fita-branca-22', avancado: true },
  ],
  gerar(p, { catalogo, removidas }) {
    const chapa = chapaPorId(catalogo, str(p, 'chapaId'));
    const fita = fitaPorId(catalogo, str(p, 'fitaId'));
    const L = num(p, 'largura');
    const A = num(p, 'altura');
    const P = num(p, 'profundidade');
    const n = Math.max(0, Math.round(num(p, 'prateleiras')));
    const hdf = bool(p, 'fundo') ? catalogo.chapas.find((c) => c.id === 'hdf-branco-3') : undefined;
    const cx = montarCaixa({ L, A, P, chapa, fita, montagem: 'laterais_inteiras', fundo: hdf, fundoEmbutido: false, juntasExtras: n, removidas });
    const pecas: Peca[] = [...cx.pecas];
    distribuir(cx.yi0, cx.yi1, n, cx.e).forEach((y, k) =>
      pecas.push(peca({ id: `prateleira-${k + 1}`, nome: 'Prateleira', papel: 'prateleira', chapa, comprimento: L - 2 * cx.e, largura: P - cx.zb, bordas: bordas(fita, { c1: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 }], box3d: caixa(cx.xi0, cx.xi1, y, y + cx.e, cx.zb, P) })),
    );
    return {
      pecas,
      ferragens: [{ ferragemId: 'parafuso-4x40', quantidade: hdf ? 16 : 8 }, { ferragemId: 'suporte-parede', quantidade: 1 }],
      extras: [],
      dimensoes: { largura: L, altura: A, profundidade: P },
    };
  },
};

export const estante: Template = {
  id: 'estante',
  nome: 'Estante com divisórias',
  descricao: 'Colunas com prateleiras fixas. Vira rack, sapateira, livreiro.',
  categoria: 'Caixas e estantes',
  horasSugeridas: 1.5,
  parametros: [
    { id: 'largura', label: 'Largura', tipo: 'numero', padrao: 800, unidade: 'mm', min: 200, max: 2700, passo: 10 },
    { id: 'altura', label: 'Altura', tipo: 'numero', padrao: 1200, unidade: 'mm', min: 150, max: 2700, passo: 10 },
    { id: 'profundidade', label: 'Profundidade', tipo: 'numero', padrao: 300, unidade: 'mm', min: 100, max: 650, passo: 5 },
    { id: 'chapaId', label: 'Chapa', tipo: 'chapa', padrao: 'mdf-branco-18' },
    { id: 'colunas', label: 'Colunas', tipo: 'numero', padrao: 2, min: 1, max: 8, passo: 1 },
    { id: 'prateleiras', label: 'Prateleiras por coluna', tipo: 'numero', padrao: 3, min: 0, max: 12, passo: 1 },
    { id: 'fundo', label: 'Fundo em HDF 3mm', tipo: 'booleano', padrao: true },
    { id: 'rodape', label: 'Rodapé', tipo: 'numero', padrao: 0, unidade: 'mm', min: 0, max: 200, passo: 10, dica: '0 = sem rodapé.' },
    { id: 'fitaId', label: 'Fita de borda', tipo: 'fita', padrao: 'fita-branca-22', avancado: true },
  ],
  validar(p, { catalogo }) {
    const chapa = chapaPorId(catalogo, str(p, 'chapaId'));
    const c = Math.max(1, Math.round(num(p, 'colunas')));
    const vao = (num(p, 'largura') - 2 * chapa.espessura - (c - 1) * chapa.espessura) / c;
    return vao < 80 ? ['Colunas estreitas demais para essa largura.'] : [];
  },
  gerar(p, { catalogo, removidas }) {
    const chapa = chapaPorId(catalogo, str(p, 'chapaId'));
    const fita = fitaPorId(catalogo, str(p, 'fitaId'));
    const L = num(p, 'largura');
    const A = num(p, 'altura');
    const P = num(p, 'profundidade');
    const c = Math.max(1, Math.round(num(p, 'colunas')));
    const n = Math.max(0, Math.round(num(p, 'prateleiras')));
    const hdf = bool(p, 'fundo') ? catalogo.chapas.find((x) => x.id === 'hdf-branco-3') : undefined;
    const cx = montarCaixa({ L, A, P, chapa, fita, montagem: 'laterais_inteiras', fundo: hdf, fundoEmbutido: false, rodape: num(p, 'rodape'), juntasExtras: n, removidas });
    const { e } = cx;
    const pecas: Peca[] = [...cx.pecas];
    const colW = (cx.xi1 - cx.xi0 - (c - 1) * e) / c;
    const prof = P - cx.zb;

    for (let k = 1; k < c; k++) {
      const x = cx.xi0 + k * colW + (k - 1) * e;
      pecas.push(peca({ id: `divisoria-${k}`, nome: 'Divisória', papel: 'divisoria', chapa, comprimento: cx.yi1 - cx.yi0, largura: prof, bordas: bordas(fita, { c1: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 + 4 * n }], box3d: caixa(x, x + e, cx.yi0, cx.yi1, cx.zb, P) }));
    }
    for (let col = 0; col < c; col++) {
      const xa = cx.xi0 + col * (colW + e);
      distribuir(cx.yi0, cx.yi1, n, e).forEach((y, k) =>
        pecas.push(peca({ id: `prateleira-${col + 1}-${k + 1}`, nome: 'Prateleira', papel: 'prateleira', chapa, comprimento: colW, largura: prof, bordas: bordas(fita, { c1: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 }], box3d: caixa(xa, xa + colW, y, y + e, cx.zb, P) })),
      );
    }
    return {
      pecas,
      ferragens: [{ ferragemId: 'parafuso-4x40', quantidade: hdf ? 24 : 12 }],
      extras: [],
      dimensoes: { largura: L, altura: A, profundidade: P },
    };
  },
};
