import type { ItemFerragem, Peca } from '../domain/types';
import { CORREDICAS, chapaPorId, criarGavetas, fitaPorId, montarCaixa } from './comum';
import { bool, num, str, type Template } from './types';


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
    { id: 'chapaPortaId', label: 'Chapa das frentes', tipo: 'chapa', padrao: '', igualA: 'chapaId' },
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
    const wFrente = Math.floor(L - 2 * f);
    const folgaC = num(p, 'folgaCorredica');
    const cx = montarCaixa({ L, A, P, chapa, fita, montagem: 'laterais_inteiras', fundo: hdf, fundoEmbutido: false, rodape: num(p, 'rodape'), removidas });
    const pecas: Peca[] = [...cx.pecas];
    const ferragens: ItemFerragem[] = [];

    const gav = criarGavetas({
      xi0: cx.xi0,
      xi1: cx.xi1,
      y0: cx.yBase + f / 2,
      y1: A - f / 2,
      n,
      zFrente: P,
      zFundo: cx.zb,
      chapa,
      chapaG,
      chapaFrente: str(p, 'chapaPortaId') ? chapaPorId(catalogo, str(p, 'chapaPortaId')) : undefined,
      fundoG: hdf,
      fita,
      folgaFrente: f,
      folgaCorredica: folgaC,
      puxador: bool(p, 'puxador'),
      modo: { tipo: 'sobreposta', xa: -wFrente / 2, xb: wFrente / 2 },
    });
    pecas.push(...gav.pecas);
    ferragens.push(...gav.ferragens);

    ferragens.push({ ferragemId: 'parafuso-4x40', quantidade: 16 + 8 * n });
    return { pecas, ferragens, extras: [], dimensoes: { largura: L, altura: A, profundidade: P + chapa.espessura } };
  },
};
