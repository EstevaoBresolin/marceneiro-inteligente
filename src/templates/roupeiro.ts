import type { ItemFerragem, Peca } from '../domain/types';
import { bordas, caixa, chapaPorId, criarGavetas, distribuir, dobradicasPorPorta, FUNDO_CHAPA, fitaPorId, metal, montarCaixa, peca } from './comum';
import { bool, num, str, type ParamDef, type Template } from './types';

const PARAMS: ParamDef[] = [
  { id: 'largura', label: 'Largura', tipo: 'numero', padrao: 1800, unidade: 'mm', min: 600, max: 3200, passo: 10 },
  { id: 'altura', label: 'Altura', tipo: 'numero', padrao: 2400, unidade: 'mm', min: 1200, max: 2750, passo: 10 },
  { id: 'profundidade', label: 'Profundidade', tipo: 'numero', padrao: 560, unidade: 'mm', min: 400, max: 700, passo: 5, dica: 'Profundidade do corpo, sem as portas.' },
  { id: 'chapaId', label: 'Chapa do corpo', tipo: 'chapa', padrao: 'mdf-branco-15' },
  { id: 'chapaPortaId', label: 'Chapa das portas e frentes', tipo: 'chapa', padrao: '', igualA: 'chapaId' },
  {
    id: 'portas',
    label: 'Portas',
    tipo: 'opcoes',
    padrao: 'correr',
    opcoes: [
      { valor: 'correr', label: 'De correr' },
      { valor: 'abrir', label: 'De abrir' },
      { valor: 'sem', label: 'Sem portas' },
    ],
  },
  { id: 'nPortas', label: 'Quantidade de portas', tipo: 'numero', padrao: 2, min: 1, max: 8, passo: 1, mostrarSe: (p) => str(p, 'portas') !== 'sem' },
  { id: 'colunas', label: 'Colunas (vãos)', tipo: 'numero', padrao: 2, min: 1, max: 6, passo: 1 },
  { id: 'cabideiros', label: 'Colunas com cabideiro', tipo: 'numero', padrao: 1, min: 0, max: 6, passo: 1, dica: 'Contando da esquerda.' },
  { id: 'gavetas', label: 'Gavetas internas', tipo: 'numero', padrao: 3, min: 0, max: 6, passo: 1, dica: 'Na última coluna, embaixo.' },
  { id: 'alturaGaveta', label: 'Altura de cada gaveta', tipo: 'numero', padrao: 180, unidade: 'mm', min: 100, max: 350, passo: 10, mostrarSe: (p) => num(p, 'gavetas') > 0 },
  { id: 'prateleiras', label: 'Prateleiras por coluna', tipo: 'numero', padrao: 3, min: 0, max: 10, passo: 1, dica: 'Nas colunas sem cabideiro.' },
  { id: 'maleiro', label: 'Maleiro em cima', tipo: 'booleano', padrao: true },
  { id: 'alturaMaleiro', label: 'Altura do maleiro', tipo: 'numero', padrao: 400, unidade: 'mm', min: 200, max: 800, passo: 10, mostrarSe: (p) => bool(p, 'maleiro') },
  { id: 'puxador', label: 'Puxador', tipo: 'booleano', padrao: true, mostrarSe: (p) => str(p, 'portas') === 'abrir' },
  { id: 'rodape', label: 'Rodapé', tipo: 'numero', padrao: 100, unidade: 'mm', min: 0, max: 200, passo: 10, dica: '0 = sem rodapé.' },
  { id: 'fitaId', label: 'Fita de borda', tipo: 'fita', padrao: 'fita-branca-22', avancado: true },
  {
    id: 'fundo',
    label: 'Fundo',
    tipo: 'opcoes',
    padrao: 'hdf3',
    avancado: true,
    opcoes: [
      { valor: 'hdf3', label: 'HDF 3mm' },
      { valor: 'mdf6', label: 'MDF 6mm' },
      { valor: 'sem', label: 'Sem fundo' },
    ],
  },
  { id: 'chapaGavetaId', label: 'Chapa da caixa da gaveta', tipo: 'chapa', padrao: 'mdf-branco-15', avancado: true },
  { id: 'sobreposicao', label: 'Sobreposição das portas de correr', tipo: 'numero', padrao: 40, unidade: 'mm', min: 10, max: 100, passo: 5, avancado: true, mostrarSe: (p) => str(p, 'portas') === 'correr' },
  { id: 'folgaPorta', label: 'Folga da porta', tipo: 'numero', padrao: 2, unidade: 'mm', min: 0, max: 10, passo: 0.5, avancado: true },
  { id: 'folgaCorredica', label: 'Folga da corrediça (cada lado)', tipo: 'numero', padrao: 12.5, unidade: 'mm', min: 0, max: 30, passo: 0.5, avancado: true },
  { id: 'recuoPrateleira', label: 'Recuo das prateleiras', tipo: 'numero', padrao: 20, unidade: 'mm', min: 0, max: 100, passo: 5, avancado: true },
];

/** trilho, roldanas e folgas da porta de correr sobreposta */
const TRILHO_H = 12;
const TRILHO_SUP_H = 30;

export const roupeiro: Template = {
  id: 'roupeiro',
  nome: 'Roupeiro',
  descricao: 'Guarda-roupa com portas de correr ou de abrir, cabideiro, gavetas internas e maleiro.',
  categoria: 'Roupeiros',
  horasSugeridas: 6,
  parametros: PARAMS,
  validar(p, { catalogo }) {
    const erros: string[] = [];
    const chapa = chapaPorId(catalogo, str(p, 'chapaId'));
    const e = chapa.espessura;
    const L = num(p, 'largura');
    const c = Math.max(1, Math.round(num(p, 'colunas')));
    const colW = (L - 2 * e - (c - 1) * e) / c;
    if (colW < 250) erros.push('Colunas estreitas demais: diminua a quantidade de colunas.');
    if (num(p, 'cabideiros') > 0 && colW < 400) erros.push('Coluna estreita para cabideiro (mínimo 400 mm).');
    const portas = str(p, 'portas');
    const n = Math.max(1, Math.round(num(p, 'nPortas')));
    if (portas === 'correr' && n < 2) erros.push('Porta de correr precisa de pelo menos 2 portas.');
    if (portas !== 'sem' && L / n < 300) erros.push('Portas estreitas demais: diminua a quantidade de portas.');
    if (portas === 'abrir' && L / n > 650) erros.push('Portas de abrir muito largas (mais de 650 mm): aumente a quantidade de portas.');
    const util = num(p, 'altura') - num(p, 'rodape') - 2 * e - (bool(p, 'maleiro') ? num(p, 'alturaMaleiro') + e : 0);
    const g = Math.round(num(p, 'gavetas'));
    if (g > 0 && g * num(p, 'alturaGaveta') + e > util - 200) erros.push('As gavetas ocupam quase toda a coluna: diminua a quantidade ou a altura.');
    return erros;
  },
  gerar(p, { catalogo, removidas }) {
    const chapa = chapaPorId(catalogo, str(p, 'chapaId'));
    const chapaG = chapaPorId(catalogo, str(p, 'chapaGavetaId'));
    const chapaP = str(p, 'chapaPortaId') ? chapaPorId(catalogo, str(p, 'chapaPortaId')) : chapa;
    const eP = chapaP.espessura;
    const fita = fitaPorId(catalogo, str(p, 'fitaId'));
    const fundoId = FUNDO_CHAPA[str(p, 'fundo')] ?? null;
    const fundo = fundoId ? catalogo.chapas.find((c) => c.id === fundoId) : undefined;
    const hdf = catalogo.chapas.find((c) => c.id === 'hdf-branco-3');
    const L = num(p, 'largura');
    const A = num(p, 'altura');
    const P = num(p, 'profundidade');
    const c = Math.max(1, Math.round(num(p, 'colunas')));
    const nCab = Math.min(c, Math.max(0, Math.round(num(p, 'cabideiros'))));
    const nGav = Math.max(0, Math.round(num(p, 'gavetas')));
    const nPrat = Math.max(0, Math.round(num(p, 'prateleiras')));
    const temMaleiro = bool(p, 'maleiro');
    const tipoPorta = str(p, 'portas');
    const nPortas = tipoPorta === 'sem' ? 0 : Math.max(tipoPorta === 'correr' ? 2 : 1, Math.round(num(p, 'nPortas')));
    const f = num(p, 'folgaPorta');
    const recuo = num(p, 'recuoPrateleira');

    const cx = montarCaixa({ L, A, P, chapa, fita, montagem: 'laterais_inteiras', fundo, fundoEmbutido: false, rodape: num(p, 'rodape'), juntasExtras: (temMaleiro ? 1 : 0) + (nGav ? 1 : 0), removidas });
    const { e, zb } = cx;
    const pecas: Peca[] = [...cx.pecas];
    const ferragens: ItemFerragem[] = [];
    const x0 = -L / 2;
    const x1 = L / 2;

    // ---------- maleiro ----------
    let yTopo = cx.yi1;
    if (temMaleiro) {
      const yMal = cx.yi1 - num(p, 'alturaMaleiro') - e;
      pecas.push(peca({ id: 'maleiro', nome: 'Prateleira do maleiro', papel: 'divisoria', chapa, comprimento: L - 2 * e, largura: P - zb, bordas: bordas(fita, { c1: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 + 2 * (c - 1) }], box3d: caixa(cx.xi0, cx.xi1, yMal, yMal + e, zb, P) }));
      yTopo = yMal;
    }

    // ---------- divisórias verticais ----------
    const colW = (cx.xi1 - cx.xi0 - (c - 1) * e) / c;
    for (let k = 1; k < c; k++) {
      const xd = cx.xi0 + k * colW + (k - 1) * e;
      pecas.push(peca({ id: `divisoria-${k}`, nome: 'Divisória', papel: 'divisoria', chapa, comprimento: yTopo - cx.yi0, largura: P - zb, bordas: bordas(fita, { c1: true }), furos: [{ tipo: 'cavilha_8', quantidade: 8 }], box3d: caixa(xd, xd + e, cx.yi0, yTopo, zb, P) }));
    }

    // ---------- conteúdo de cada coluna ----------
    for (let j = 0; j < c; j++) {
      const xa = cx.xi0 + j * (colW + e);
      const xb = xa + colW;
      if (j < nCab) {
        const yTubo = yTopo - 70;
        const zm = (zb + P) / 2;
        const tubo = metal(`cabideiro-${j + 1}`, 'Tubo do cabideiro', caixa(xa, xb, yTubo - 15, yTubo + 15, zm - 8, zm + 8));
        pecas.push(tubo);
        ferragens.push({ ferragemId: 'tubo-cabideiro', quantidade: Math.round(colW) / 1000, pecaId: tubo.id }, { ferragemId: 'suporte-cabideiro', quantidade: 2, pecaId: tubo.id });
        continue;
      }
      let yLivre0 = cx.yi0;
      if (j === c - 1 && nGav > 0) {
        const hZona = nGav * num(p, 'alturaGaveta');
        const gav = criarGavetas({
          xi0: xa,
          xi1: xb,
          y0: cx.yi0,
          y1: cx.yi0 + hZona,
          n: nGav,
          zFrente: P,
          zFundo: zb,
          chapa,
          chapaG,
          chapaFrente: chapaP,
          fundoG: hdf,
          fita,
          folgaFrente: 3,
          folgaCorredica: num(p, 'folgaCorredica'),
          puxador: false,
          modo: { tipo: 'interna', recuo: tipoPorta === 'abrir' ? 30 : 5 },
        });
        pecas.push(...gav.pecas);
        ferragens.push(...gav.ferragens);
        const ySh = cx.yi0 + hZona;
        pecas.push(peca({ id: 'tampo-gavetas', nome: 'Prateleira sobre as gavetas', papel: 'divisoria', chapa, comprimento: colW, largura: P - zb, bordas: bordas(fita, { c1: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 }], box3d: caixa(xa, xb, ySh, ySh + e, zb, P) }));
        yLivre0 = ySh + e;
      }
      if (nPrat > 0) {
        const profPrat = P - zb - recuo;
        const largPrat = colW - 2;
        distribuir(yLivre0, yTopo, nPrat, e).forEach((y, k) => {
          const id = `prateleira-${j + 1}-${k + 1}`;
          pecas.push(peca({ id, nome: 'Prateleira', papel: 'prateleira', chapa, comprimento: largPrat, largura: profPrat, bordas: bordas(fita, { c1: true }), box3d: caixa(xa + 1, xb - 1, y, y + e, zb, zb + profPrat) }));
          ferragens.push({ ferragemId: 'suporte-prateleira', quantidade: 4, pecaId: id });
        });
      }
    }

    // ---------- portas ----------
    let frente = 0;
    if (tipoPorta === 'correr' && nPortas >= 2) {
      const ov = num(p, 'sobreposicao');
      const w = Math.floor((L + ov * (nPortas - 1)) / nPortas);
      const y0 = cx.yBase + TRILHO_H + 3;
      const y1 = A - TRILHO_SUP_H;
      const zTrilho0 = P + 3;
      for (let i = 0; i < nPortas; i++) {
        const xa = x0 + i * (w - ov);
        const z0 = zTrilho0 + (i % 2 === 0 ? 2 : eP + 8);
        const id = `porta-${i + 1}`;
        const box = { ...caixa(xa, xa + w, y0, y1, z0, z0 + eP), correr: i % 2 === 1 ? -(w - ov) : 0 };
        pecas.push(peca({ id, nome: `Porta de correr ${i + 1}`, papel: 'porta', chapa: chapaP, comprimento: y1 - y0, largura: w, bordas: bordas(fita, { c1: true, c2: true, l1: true, l2: true }), box3d: box, podeGirar: !chapaP.temVeio }));
        ferragens.push({ ferragemId: 'kit-porta-correr', quantidade: 1, pecaId: id });
      }
      frente = 2 * eP + 13;
      const zT1 = P + frente;
      pecas.push(metal('trilho-superior', 'Trilho superior', caixa(x0, x1, A - TRILHO_SUP_H, A, P, zT1)), metal('trilho-inferior', 'Trilho inferior', caixa(x0, x1, cx.yBase, cx.yBase + TRILHO_H, P, zT1)));
      ferragens.push({ ferragemId: 'trilho-correr', quantidade: (2 * Math.round(L)) / 1000, pecaId: 'trilho-superior' });
    } else if (tipoPorta === 'abrir' && nPortas > 0) {
      const w = Math.floor((L - (nPortas + 1) * f) / nPortas);
      const y0 = cx.yBase + f;
      const h = Math.floor(A - f - y0);
      const nDob = dobradicasPorPorta(h);
      for (let i = 0; i < nPortas; i++) {
        const xa = x0 + f + i * (w + f);
        const xb = xa + w;
        // portas em pares: a da esquerda gira na esquerda, a da direita na direita
        const esquerda = i % 2 === 0;
        const box = caixa(xa, xb, y0, y0 + h, P, P + eP);
        box.dobradica = esquerda ? { x: xa, z: P, sinal: -1 } : { x: xb, z: P, sinal: 1 };
        const id = `porta-${i + 1}`;
        pecas.push(peca({ id, nome: `Porta ${i + 1}`, papel: 'porta', chapa: chapaP, comprimento: h, largura: w, bordas: bordas(fita, { c1: true, c2: true, l1: true, l2: true }), furos: [{ tipo: 'dobradica_35', quantidade: nDob }, { tipo: 'puxador', quantidade: bool(p, 'puxador') ? 1 : 0 }], box3d: box }));
        ferragens.push({ ferragemId: 'dobradica-35', quantidade: nDob, pecaId: id });
        if (bool(p, 'puxador')) ferragens.push({ ferragemId: 'puxador', quantidade: 1, pecaId: id });
      }
      frente = eP;
    }

    ferragens.push({ ferragemId: 'parafuso-4x40', quantidade: 24 + 4 * c });
    return { pecas, ferragens, extras: [], dimensoes: { largura: L, altura: A, profundidade: P + frente } };
  },
};
