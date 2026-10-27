import type { ItemFerragem, Peca } from '../domain/types';
import { bordas, caixa, chapaPorId, fitaPorId, montarCaixa, peca } from './comum';
import { bool, num, str, type Template } from './types';

/** comprimentos comerciais de corrediça telescópica, mm */
const CORREDICAS = [250, 300, 350, 400, 450, 500, 550, 600];

export const gaveteiro: Template = {
  id: 'gaveteiro',
  nome: 'Gaveteiro',
  descricao: 'Caixa com gavetas em corrediça telescópica e frentes sobrepostas.',
  categoria: 'Gavetas',
  horasSugeridas: 2,
  parametros: [
    { id: 'largura', label: 'Largura', tipo: 'numero', padrao: 450, unidade: 'mm', min: 250, max: 1200, passo: 10 },
    { id: 'altura', label: 'Altura', tipo: 'numero', padrao: 600, unidade: 'mm', min: 150, max: 1500, passo: 10 },
    { id: 'profundidade', label: 'Profundidade', tipo: 'numero', padrao: 450, unidade: 'mm', min: 280, max: 650, passo: 5 },
    { id: 'chapaId', label: 'Chapa', tipo: 'chapa', padrao: 'mdf-branco-15' },
    { id: 'gavetas', label: 'Gavetas', tipo: 'numero', padrao: 3, min: 1, max: 8, passo: 1 },
    { id: 'puxador', label: 'Puxador', tipo: 'booleano', padrao: true },
    { id: 'rodape', label: 'Rodapé', tipo: 'numero', padrao: 0, unidade: 'mm', min: 0, max: 200, passo: 10, dica: '0 = sem rodapé.' },
    { id: 'chapaGavetaId', label: 'Chapa da caixa da gaveta', tipo: 'chapa', padrao: 'mdf-branco-15', avancado: true },
    { id: 'fitaId', label: 'Fita de borda', tipo: 'fita', padrao: 'fita-branca-22', avancado: true },
    { id: 'folgaFrente', label: 'Folga entre frentes', tipo: 'numero', padrao: 2, unidade: 'mm', min: 0, max: 10, passo: 0.5, avancado: true },
    { id: 'folgaCorredica', label: 'Folga da corrediça (cada lado)', tipo: 'numero', padrao: 12.5, unidade: 'mm', min: 0, max: 30, passo: 0.5, avancado: true },
  ],
  validar(p, { catalogo }) {
    const chapa = chapaPorId(catalogo, str(p, 'chapaId'));
    const erros: string[] = [];
    const util = num(p, 'altura') - num(p, 'rodape') - 2 * chapa.espessura;
    if (util / Math.max(1, num(p, 'gavetas')) < 90) erros.push('Gavetas baixas demais: diminua a quantidade ou aumente a altura.');
    if (num(p, 'profundidade') - 3 - 10 < CORREDICAS[0]) erros.push('Profundidade pequena para a menor corrediça (250 mm).');
    return erros;
  },
  gerar(p, { catalogo, removidas }) {
    const chapa = chapaPorId(catalogo, str(p, 'chapaId'));
    const chapaG = chapaPorId(catalogo, str(p, 'chapaGavetaId'));
    const hdf = catalogo.chapas.find((x) => x.id === 'hdf-branco-3');
    const fita = fitaPorId(catalogo, str(p, 'fitaId'));
    const L = num(p, 'largura');
    const A = num(p, 'altura');
    const P = num(p, 'profundidade');
    const n = Math.max(1, Math.round(num(p, 'gavetas')));
    const f = num(p, 'folgaFrente');
    const folgaC = num(p, 'folgaCorredica');
    const cx = montarCaixa({ L, A, P, chapa, fita, montagem: 'laterais_inteiras', fundo: hdf, fundoEmbutido: false, rodape: num(p, 'rodape'), removidas });
    const { e } = cx;
    const pecas: Peca[] = [...cx.pecas];
    const ferragens: ItemFerragem[] = [];

    const profUtil = P - cx.zb - 10;
    const corr = [...CORREDICAS].reverse().find((c) => c <= profUtil) ?? CORREDICAS[0];
    const hFrente = Math.floor((A - cx.yBase - (n + 1) * f) / n);
    const wFrente = Math.floor(L - 2 * f);
    const eg = chapaG.espessura;
    const Wg = Math.floor(cx.xi1 - cx.xi0 - 2 * folgaC);
    const hc = Math.max(60, hFrente - 40);
    const curso = Math.round(corr * 0.75);
    const tFundoG = hdf?.espessura ?? 3;

    for (let k = 0; k < n; k++) {
      const yF = cx.yBase + f + k * (hFrente + f);
      const g = `gaveta-${k + 1}`;
      const frente = peca({
        id: `${g}-frente`,
        nome: `Frente da gaveta ${k + 1}`,
        papel: 'porta',
        chapa,
        comprimento: wFrente,
        largura: hFrente,
        bordas: bordas(fita, { c1: true, c2: true, l1: true, l2: true }),
        furos: [{ tipo: 'puxador', quantidade: bool(p, 'puxador') ? 1 : 0 }, { tipo: 'parafuso', quantidade: 4 }],
        box3d: { ...caixa(-wFrente / 2, wFrente / 2, yF, yF + hFrente, P, P + e), gaveta: curso },
      });
      pecas.push(frente);
      ferragens.push({ ferragemId: 'corredica-telescopica', quantidade: 1, pecaId: frente.id });
      if (bool(p, 'puxador')) ferragens.push({ ferragemId: 'puxador', quantidade: 1, pecaId: frente.id });

      // caixa da gaveta: laterais por fora, frente interna e traseira entre elas, fundo pregado por baixo
      const yc = yF + 15;
      const zc0 = P - corr;
      const xg0 = -Wg / 2;
      const xg1 = Wg / 2;
      const sub = (id: string, nome: string, comprimento: number, largura: number, box: ReturnType<typeof caixa>, c?: typeof chapa, b = false) => ({
        ...peca({ id: `${g}-${id}`, nome: `Gaveta ${k + 1}: ${nome}`, papel: 'outro', chapa: c ?? chapaG, comprimento, largura, bordas: b ? bordas(fita, { c1: true }) : undefined, furos: c ? [] : [{ tipo: 'cavilha_8', quantidade: 2 }], box3d: { ...box, gaveta: curso } }),
        dependeDe: frente.id,
      });
      pecas.push(
        sub('lat-esq', 'lateral', corr, hc, caixa(xg0, xg0 + eg, yc, yc + hc, zc0, P), undefined, true),
        sub('lat-dir', 'lateral', corr, hc, caixa(xg1 - eg, xg1, yc, yc + hc, zc0, P), undefined, true),
        sub('contrafrente', 'contrafrente', Wg - 2 * eg, hc, caixa(xg0 + eg, xg1 - eg, yc, yc + hc, P - eg, P)),
        sub('traseira', 'traseira', Wg - 2 * eg, hc, caixa(xg0 + eg, xg1 - eg, yc, yc + hc, zc0, zc0 + eg), undefined, true),
      );
      if (hdf) pecas.push(sub('fundo', 'fundo', corr, Wg, caixa(xg0, xg1, yc - tFundoG, yc, zc0, P), hdf));
    }

    ferragens.push({ ferragemId: 'parafuso-4x40', quantidade: 16 + 8 * n });
    return { pecas, ferragens, extras: [], dimensoes: { largura: L, altura: A, profundidade: P + e } };
  },
};
