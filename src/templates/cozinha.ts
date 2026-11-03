import type { ItemFerragem, Peca } from '../domain/types';
import { gerarArmario } from './armarioBanheiro';
import { bordas, caixa, chapaPorId, criarGavetas, distribuir, dobradicasPorPorta, FUNDO_CHAPA, fitaPorId, montarCaixa, peca } from './comum';
import { bool, num, str, type ParamDef, type Template } from './types';

const base = (o: { largura: number; altura: number; profundidade: number }): ParamDef[] => [
  { id: 'largura', label: 'Largura', tipo: 'numero', padrao: o.largura, unidade: 'mm', min: 300, max: 2400, passo: 10 },
  { id: 'altura', label: 'Altura', tipo: 'numero', padrao: o.altura, unidade: 'mm', min: 300, max: 2700, passo: 10, dica: 'Sem a pedra ou o tampo.' },
  { id: 'profundidade', label: 'Profundidade', tipo: 'numero', padrao: o.profundidade, unidade: 'mm', min: 250, max: 700, passo: 5, dica: 'Profundidade do corpo, sem a porta.' },
  { id: 'chapaId', label: 'Chapa do corpo', tipo: 'chapa', padrao: 'mdf-branco-15' },
  { id: 'chapaPortaId', label: 'Chapa das portas e frentes', tipo: 'chapa', padrao: '', igualA: 'chapaId' },
];

const avancado: ParamDef[] = [
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
  { id: 'folgaPorta', label: 'Folga da porta', tipo: 'numero', padrao: 2, unidade: 'mm', min: 0, max: 10, passo: 0.5, avancado: true },
  { id: 'recuoPrateleira', label: 'Recuo das prateleiras', tipo: 'numero', padrao: 20, unidade: 'mm', min: 0, max: 100, passo: 5, avancado: true },
];

// ---------------------------------------------------------------------------
// Balcão de pia: sem tampo (a pedra apoia em travessas), fundo aberto para a hidráulica
// ---------------------------------------------------------------------------
export const balcaoPia: Template = {
  id: 'balcao-pia',
  nome: 'Balcão de pia',
  descricao: 'Balcão sem tampo, com travessas para a pedra e sem fundo para o encanamento.',
  categoria: 'Cozinha',
  horasSugeridas: 1.5,
  parametros: [
    ...base({ largura: 1200, altura: 820, profundidade: 530 }),
    { id: 'portas', label: 'Portas', tipo: 'opcoes', padrao: '2', opcoes: [{ valor: '1', label: '1 porta' }, { valor: '2', label: '2 portas' }] },
    { id: 'prateleiras', label: 'Prateleiras internas', tipo: 'numero', padrao: 0, min: 0, max: 3, passo: 1 },
    { id: 'puxador', label: 'Puxador', tipo: 'booleano', padrao: true },
    { id: 'rodape', label: 'Rodapé', tipo: 'numero', padrao: 100, unidade: 'mm', min: 0, max: 200, passo: 10, dica: '0 = sem rodapé.' },
    { id: 'larguraTravessa', label: 'Largura das travessas', tipo: 'numero', padrao: 100, unidade: 'mm', min: 60, max: 200, passo: 10, avancado: true },
    ...avancado.map((d) => (d.id === 'fundo' ? { ...d, padrao: 'sem' } : d)),
  ],
  validar(p, { catalogo }) {
    const e = chapaPorId(catalogo, str(p, 'chapaId')).espessura;
    return num(p, 'largura') / (str(p, 'portas') === '2' ? 2 : 1) > 650 ? ['Portas muito largas (mais de 650 mm): use 2 portas ou diminua a largura.'] : num(p, 'largura') < 2 * e + 200 ? ['Largura muito pequena.'] : [];
  },
  gerar(p, ctx) {
    const r = gerarArmario({ ...p, espelho: 'sem', nicho: false, montagem: 'laterais_inteiras', fixacaoFundo: 'pregado' }, ctx);
    const chapa = chapaPorId(ctx.catalogo, str(p, 'chapaId'));
    const fita = fitaPorId(ctx.catalogo, str(p, 'fitaId'));
    const e = chapa.espessura;
    const L = num(p, 'largura');
    const A = num(p, 'altura');
    const P = num(p, 'profundidade');
    const t = num(p, 'larguraTravessa');
    const fundo = r.pecas.find((x) => x.id === 'fundo');
    const zb = fundo && fundo.box3d && fundo.box3d.pos[2] < 10 ? fundo.box3d.size[2] : 0;
    const pecas = r.pecas.filter((x) => x.id !== 'tampo');
    pecas.push(
      peca({ id: 'travessa-frente', nome: 'Travessa da frente', papel: 'tampo', chapa, comprimento: L - 2 * e, largura: t, bordas: bordas(fita, { c1: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 }], box3d: caixa(-L / 2 + e, L / 2 - e, A - e, A, P - t, P) }),
      peca({ id: 'travessa-tras', nome: 'Travessa de trás', papel: 'tampo', chapa, comprimento: L - 2 * e, largura: t, furos: [{ tipo: 'cavilha_8', quantidade: 4 }], box3d: caixa(-L / 2 + e, L / 2 - e, A - e, A, zb, zb + t) }),
    );
    return { ...r, pecas, ferragens: r.ferragens.filter((x) => x.ferragemId !== 'suporte-parede') };
  },
};

// ---------------------------------------------------------------------------
// Canto cego: o vizinho encosta na parte cega; a porta fica na parte livre
// ---------------------------------------------------------------------------
export const cantoCego: Template = {
  id: 'canto-cego',
  nome: 'Balcão de canto',
  descricao: 'Módulo de canto em L: parte da frente fica cega, onde encosta o balcão do outro lado.',
  categoria: 'Cozinha',
  horasSugeridas: 2,
  parametros: [
    ...base({ largura: 1000, altura: 820, profundidade: 530 }),
    { id: 'ladoCego', label: 'Lado cego', tipo: 'opcoes', padrao: 'esq', opcoes: [{ valor: 'esq', label: 'Esquerda' }, { valor: 'dir', label: 'Direita' }] },
    { id: 'larguraCega', label: 'Largura da parte cega', tipo: 'numero', padrao: 580, unidade: 'mm', min: 100, max: 1200, passo: 10, dica: 'Profundidade do balcão que encosta + uns 50 mm de folga.' },
    { id: 'prateleiras', label: 'Prateleiras internas', tipo: 'numero', padrao: 1, min: 0, max: 6, passo: 1 },
    { id: 'puxador', label: 'Puxador', tipo: 'booleano', padrao: true },
    { id: 'rodape', label: 'Rodapé', tipo: 'numero', padrao: 100, unidade: 'mm', min: 0, max: 200, passo: 10, dica: '0 = sem rodapé.' },
    ...avancado,
  ],
  validar(p) {
    const livre = num(p, 'largura') - num(p, 'larguraCega');
    return livre < 250 ? ['Sobra pouco para a porta: aumente a largura ou diminua a parte cega.'] : [];
  },
  gerar(p, ctx) {
    const r = gerarArmario({ ...p, portas: '0', espelho: 'sem', nicho: false, montagem: 'laterais_inteiras', fixacaoFundo: 'pregado' }, ctx);
    const chapa = chapaPorId(ctx.catalogo, str(p, 'chapaId'));
    const fita = fitaPorId(ctx.catalogo, str(p, 'fitaId'));
    const e = chapa.espessura;
    const L = num(p, 'largura');
    const A = num(p, 'altura');
    const P = num(p, 'profundidade');
    const f = num(p, 'folgaPorta');
    const yb = num(p, 'rodape');
    const cego = Math.min(num(p, 'larguraCega'), L - 250);
    const chapaP = str(p, 'chapaPortaId') ? chapaPorId(ctx.catalogo, str(p, 'chapaPortaId')) : chapa;
    const eP = chapaP.espessura;
    const esq = str(p, 'ladoCego') !== 'dir';
    const x0 = -L / 2;
    const x1 = L / 2;
    const pecas: Peca[] = [...r.pecas];
    const ferragens: ItemFerragem[] = [...r.ferragens.filter((x) => x.ferragemId !== 'suporte-parede')];
    const y0 = yb + f;
    const h = Math.floor(A - f - y0);

    // painel cego fixo na frente
    const [ca, cb] = esq ? [x0, x0 + cego] : [x1 - cego, x1];
    pecas.push(peca({ id: 'painel-cego', nome: 'Painel cego', papel: 'outro', chapa: chapaP, comprimento: h, largura: cb - ca, bordas: bordas(fita, { c1: true, c2: true, l1: true, l2: true }), furos: [{ tipo: 'parafuso', quantidade: 4 }], box3d: caixa(ca, cb, y0, y0 + h, P, P + eP) }));

    // porta(s) na parte livre, abrindo para longe do canto
    const [la, lb] = esq ? [x0 + cego + f, x1 - f] : [x0 + f, x1 - cego - f];
    const livre = lb - la;
    const n = livre > 650 ? 2 : 1;
    const w = Math.floor((livre - (n - 1) * f) / n);
    const nDob = dobradicasPorPorta(h);
    for (let i = 0; i < n; i++) {
      const xa = la + i * (w + f);
      const box = caixa(xa, xa + w, y0, y0 + h, P, P + eP);
      const naEsquerda = n === 2 ? i === 0 : !esq;
      box.dobradica = naEsquerda ? { x: xa, z: P, sinal: -1 } : { x: xa + w, z: P, sinal: 1 };
      const id = `porta-${i + 1}`;
      pecas.push(peca({ id, nome: n === 1 ? 'Porta' : `Porta ${i + 1}`, papel: 'porta', chapa: chapaP, comprimento: h, largura: w, bordas: bordas(fita, { c1: true, c2: true, l1: true, l2: true }), furos: [{ tipo: 'dobradica_35', quantidade: nDob }, { tipo: 'puxador', quantidade: bool(p, 'puxador') ? 1 : 0 }], box3d: box }));
      ferragens.push({ ferragemId: 'dobradica-35', quantidade: nDob, pecaId: id });
      if (bool(p, 'puxador')) ferragens.push({ ferragemId: 'puxador', quantidade: 1, pecaId: id });
    }
    void e;
    return { ...r, pecas, ferragens, dimensoes: { largura: L, altura: A, profundidade: P + eP } };
  },
};

// ---------------------------------------------------------------------------
// Torre quente: gavetas embaixo, vão do forno, vão do micro-ondas e porta em cima
// ---------------------------------------------------------------------------
export const torreForno: Template = {
  id: 'torre-forno',
  nome: 'Torre de forno',
  descricao: 'Torre alta com gavetas, nicho para forno embutido, micro-ondas e porta em cima.',
  categoria: 'Cozinha',
  horasSugeridas: 3,
  parametros: [
    ...base({ largura: 600, altura: 2200, profundidade: 560 }),
    { id: 'gavetas', label: 'Gavetas embaixo', tipo: 'numero', padrao: 2, min: 0, max: 4, passo: 1 },
    { id: 'alturaGavetas', label: 'Altura da área das gavetas', tipo: 'numero', padrao: 520, unidade: 'mm', min: 150, max: 900, passo: 10, mostrarSe: (p) => num(p, 'gavetas') > 0 },
    { id: 'alturaForno', label: 'Vão do forno', tipo: 'numero', padrao: 595, unidade: 'mm', min: 350, max: 900, passo: 5, dica: 'Altura livre; confira no manual do forno.' },
    { id: 'alturaMicro', label: 'Vão do micro-ondas', tipo: 'numero', padrao: 390, unidade: 'mm', min: 0, max: 600, passo: 5, dica: '0 = sem micro-ondas.' },
    { id: 'portaSuperior', label: 'Porta em cima', tipo: 'booleano', padrao: true },
    { id: 'puxador', label: 'Puxador', tipo: 'booleano', padrao: true },
    { id: 'rodape', label: 'Rodapé', tipo: 'numero', padrao: 100, unidade: 'mm', min: 0, max: 200, passo: 10, dica: '0 = sem rodapé.' },
    { id: 'chapaGavetaId', label: 'Chapa da caixa da gaveta', tipo: 'chapa', padrao: 'mdf-branco-15', avancado: true },
    { id: 'folgaCorredica', label: 'Folga da corrediça (cada lado)', tipo: 'numero', padrao: 12.5, unidade: 'mm', min: 0, max: 30, passo: 0.5, avancado: true },
    ...avancado,
  ],
  validar(p, { catalogo }) {
    const e = chapaPorId(catalogo, str(p, 'chapaId')).espessura;
    const usado = (num(p, 'gavetas') > 0 ? num(p, 'alturaGavetas') : 0) + num(p, 'alturaForno') + (num(p, 'alturaMicro') > 0 ? num(p, 'alturaMicro') + e : 0) + 3 * e;
    const erros: string[] = [];
    if (usado > num(p, 'altura') - num(p, 'rodape') - 150) erros.push('Gavetas, forno e micro-ondas não cabem nessa altura.');
    if (num(p, 'largura') < 560) erros.push('Forno embutido costuma pedir pelo menos 560 mm de vão: confira a largura.');
    return erros;
  },
  gerar(p, { catalogo, removidas }) {
    const chapa = chapaPorId(catalogo, str(p, 'chapaId'));
    const chapaG = chapaPorId(catalogo, str(p, 'chapaGavetaId'));
    const chapaP = str(p, 'chapaPortaId') ? chapaPorId(catalogo, str(p, 'chapaPortaId')) : chapa;
    const fita = fitaPorId(catalogo, str(p, 'fitaId'));
    const fundoId = FUNDO_CHAPA[str(p, 'fundo')] ?? null;
    const fundo = fundoId ? catalogo.chapas.find((c) => c.id === fundoId) : undefined;
    const hdf = catalogo.chapas.find((c) => c.id === 'hdf-branco-3');
    const L = num(p, 'largura');
    const A = num(p, 'altura');
    const P = num(p, 'profundidade');
    const f = num(p, 'folgaPorta');
    const nGav = Math.max(0, Math.round(num(p, 'gavetas')));
    const hMicro = num(p, 'alturaMicro');
    const cx = montarCaixa({ L, A, P, chapa, fita, montagem: 'laterais_inteiras', fundo, fundoEmbutido: false, rodape: num(p, 'rodape'), juntasExtras: 2 + (hMicro > 0 ? 1 : 0), removidas });
    const { e, zb } = cx;
    const pecas: Peca[] = [...cx.pecas];
    const ferragens: ItemFerragem[] = [];
    const fixa = (id: string, nome: string, y: number) =>
      peca({ id, nome, papel: 'divisoria', chapa, comprimento: L - 2 * e, largura: P - zb, bordas: bordas(fita, { c1: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 }], box3d: caixa(cx.xi0, cx.xi1, y, y + e, zb, P) });

    // gavetas
    let y = cx.yi0;
    if (nGav > 0) {
      const yTopoGav = cx.yBase + num(p, 'alturaGavetas');
      pecas.push(fixa('base-forno', 'Base do forno', yTopoGav));
      const gav = criarGavetas({
        xi0: cx.xi0,
        xi1: cx.xi1,
        y0: cx.yBase + f / 2,
        y1: yTopoGav + e / 2 - f / 2,
        n: nGav,
        zFrente: P,
        zFundo: zb,
        chapa,
        chapaG,
        chapaFrente: chapaP,
        fundoG: hdf,
        fita,
        folgaFrente: f,
        folgaCorredica: num(p, 'folgaCorredica'),
        puxador: bool(p, 'puxador'),
        modo: { tipo: 'sobreposta', xa: -L / 2 + f, xb: L / 2 - f },
      });
      pecas.push(...gav.pecas);
      ferragens.push(...gav.ferragens);
      y = yTopoGav + e;
    }
    // forno
    y += num(p, 'alturaForno');
    pecas.push(fixa('teto-forno', 'Teto do forno', y));
    y += e;
    // micro-ondas
    if (hMicro > 0) {
      y += hMicro;
      pecas.push(fixa('teto-micro', 'Teto do micro-ondas', y));
      y += e;
    }
    // porta em cima
    if (bool(p, 'portaSuperior') && cx.yi1 - y > 150) {
      const y0 = y - e / 2 + f / 2;
      const h = Math.floor(A - f - y0);
      const n = L > 650 ? 2 : 1;
      const w = Math.floor((L - (n + 1) * f) / n);
      const nDob = dobradicasPorPorta(h);
      for (let i = 0; i < n; i++) {
        const xa = -L / 2 + f + i * (w + f);
        const box = caixa(xa, xa + w, y0, y0 + h, P, P + chapaP.espessura);
        box.dobradica = i === 0 ? { x: xa, z: P, sinal: -1 } : { x: xa + w, z: P, sinal: 1 };
        const id = `porta-${i + 1}`;
        pecas.push(peca({ id, nome: n === 1 ? 'Porta de cima' : `Porta de cima ${i + 1}`, papel: 'porta', chapa: chapaP, comprimento: h, largura: w, bordas: bordas(fita, { c1: true, c2: true, l1: true, l2: true }), furos: [{ tipo: 'dobradica_35', quantidade: nDob }, { tipo: 'puxador', quantidade: bool(p, 'puxador') ? 1 : 0 }], box3d: box }));
        ferragens.push({ ferragemId: 'dobradica-35', quantidade: nDob, pecaId: id });
        if (bool(p, 'puxador')) ferragens.push({ ferragemId: 'puxador', quantidade: 1, pecaId: id });
      }
      // uma prateleira solta no vão de cima
      const yp = distribuir(y, cx.yi1, 1, e)[0];
      const prof = P - zb - num(p, 'recuoPrateleira');
      pecas.push(peca({ id: 'prateleira-1', nome: 'Prateleira', papel: 'prateleira', chapa, comprimento: L - 2 * e - 2, largura: prof, bordas: bordas(fita, { c1: true }), box3d: caixa(cx.xi0 + 1, cx.xi1 - 1, yp, yp + e, zb, zb + prof) }));
      ferragens.push({ ferragemId: 'suporte-prateleira', quantidade: 4, pecaId: 'prateleira-1' });
    }
    ferragens.push({ ferragemId: 'parafuso-4x40', quantidade: 24 });
    return { pecas, ferragens, extras: [], dimensoes: { largura: L, altura: A, profundidade: P + chapaP.espessura } };
  },
};
