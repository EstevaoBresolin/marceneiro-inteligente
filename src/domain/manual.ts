import type { ProjetoMontado } from './composicao';
import { moduloDaPeca } from './composicao';
import type { Catalogo, Peca } from './types';

export type Passo = {
  titulo: string;
  texto: string;
  /** peças que entram neste passo (destacadas) */
  novas: string[];
  /** tudo o que aparece no desenho deste passo */
  visiveis: string[];
  pecas: { numero: string; nome: string; medida: string }[];
  ferragens: { nome: string; qtd: number }[];
};

type Etapa = { chave: string; titulo: string; texto: string; filtro: (p: Peca) => boolean; ferragens?: string[] };

const temCavilha = (p: Peca) => p.furos.some((f) => f.tipo === 'cavilha_8');
const ehGaveta = (p: Peca) => /gaveta-\d+-/.test(p.id);
const ehFrenteGaveta = (p: Peca) => /gaveta-\d+-frente$/.test(p.id);

const ETAPAS: Etapa[] = [
  {
    chave: 'base',
    titulo: 'Junte as laterais na base',
    texto: 'Passe cola nas cavilhas e encaixe as laterais na base (e no rodapé, se tiver). Aperte com grampos e confira se ficou no esquadro.',
    filtro: (p) => !ehGaveta(p) && (p.papel === 'lateral' || p.papel === 'base' || /rodape/.test(p.id)),
  },
  { chave: 'tampo', titulo: 'Feche com o tampo', texto: 'Cole as cavilhas e encaixe o tampo por cima das laterais.', filtro: (p) => !ehGaveta(p) && p.papel === 'tampo' },
  {
    chave: 'fixas',
    titulo: 'Divisórias e prateleiras fixas',
    texto: 'Encaixe as divisórias e as prateleiras fixas nas cavilhas, de baixo para cima.',
    filtro: (p) => !ehGaveta(p) && (p.papel === 'divisoria' || (p.papel === 'prateleira' && temCavilha(p))),
  },
  {
    chave: 'fundo',
    titulo: 'Pregue o fundo',
    texto: 'Meça as duas diagonais da caixa: se forem iguais, ela está no esquadro. Só então pregue ou parafuse o fundo a cada 15 cm.',
    filtro: (p) => p.papel === 'fundo' && !ehGaveta(p),
    ferragens: ['parafuso-4x40'],
  },
  {
    chave: 'prateleiras',
    titulo: 'Pinos e prateleiras',
    texto: 'Coloque os pinos nos furos da altura que quiser e apoie as prateleiras.',
    filtro: (p) => p.papel === 'prateleira' && !temCavilha(p) && !ehGaveta(p),
    ferragens: ['suporte-prateleira'],
  },
  {
    chave: 'caixasGaveta',
    titulo: 'Monte as caixas das gavetas',
    texto: 'Cole as cavilhas e junte laterais, contrafrente e traseira de cada gaveta. Confira o esquadro e pregue o fundo por baixo.',
    filtro: (p) => ehGaveta(p) && !ehFrenteGaveta(p),
  },
  {
    chave: 'frentes',
    titulo: 'Corrediças e frentes das gavetas',
    texto: 'Parafuse as corrediças nas laterais do móvel e nas caixas, encaixe as gavetas e fixe as frentes por dentro com 4 parafusos, deixando a folga igual entre elas.',
    filtro: (p) => ehFrenteGaveta(p),
    ferragens: ['corredica-telescopica', 'puxador'],
  },
  {
    chave: 'portas',
    titulo: 'Instale as portas',
    texto: 'Encaixe as dobradiças nos canecos da porta, prenda os calços na lateral e encaixe. Regule pelos parafusos da dobradiça até as folgas ficarem iguais.',
    filtro: (p) => (p.papel === 'porta' && !ehFrenteGaveta(p)) || (p.papel === 'espelho' && !p.dependeDe),
    ferragens: ['dobradica-35', 'dobradica-vidro', 'puxador'],
  },
  {
    chave: 'espelho',
    titulo: 'Cole o espelho',
    texto: 'Limpe a porta, aplique silicone neutro próprio para espelho em cordões verticais e apoie o espelho centralizado. Deixe deitado 24 h antes de pendurar.',
    filtro: (p) => p.papel === 'espelho' && !!p.dependeDe,
  },
  { chave: 'outras', titulo: 'Peças avulsas', texto: 'Posicione e fixe as demais peças conforme o desenho.', filtro: () => true },
];

export function gerarManual(m: ProjetoMontado, catalogo: Catalogo, numeros: Map<string, string>): Passo[] {
  const passos: Passo[] = [];
  const visiveis: string[] = [];
  const nomeFerr = (id: string) => catalogo.ferragens.find((f) => f.id === id)?.nome ?? id;
  const varios = m.modulos.length > 1;
  const usadas = new Set<string>();

  for (const mod of m.modulos) {
    const doModulo = m.pecas.filter((p) => moduloDaPeca(p.id) === mod.modulo.id && p.box3d);
    const restantes = new Set(doModulo.map((p) => p.id));
    for (const et of ETAPAS) {
      const novas = doModulo.filter((p) => restantes.has(p.id) && et.filtro(p));
      if (!novas.length) continue;
      for (const p of novas) restantes.delete(p.id);
      // espelho colado na porta aparece junto com a porta, mas é passo próprio
      visiveis.push(...novas.map((p) => p.id));
      const ids = new Set(novas.map((p) => p.id));
      const ferr = new Map<string, number>();
      for (const f of m.ferragens) {
        if (f.moduloId !== mod.modulo.id) continue;
        const daPeca = f.pecaId && ids.has(f.pecaId);
        const daEtapa = !f.pecaId && et.ferragens?.includes(f.ferragemId);
        if (!(daPeca || daEtapa)) continue;
        const k = `${f.ferragemId}|${f.pecaId ?? ''}|${mod.modulo.id}`;
        if (usadas.has(k)) continue;
        usadas.add(k);
        ferr.set(f.ferragemId, (ferr.get(f.ferragemId) ?? 0) + f.quantidade);
      }
      passos.push({
        titulo: varios ? `${mod.modulo.nome}: ${et.titulo.charAt(0).toLowerCase()}${et.titulo.slice(1)}` : et.titulo,
        texto: et.texto,
        novas: novas.map((p) => p.id),
        visiveis: [...visiveis],
        pecas: novas.filter((p) => !p.somente3d).map((p) => ({ numero: numeros.get(p.id) ?? '', nome: p.nome.replace(/^.*?: /, ''), medida: `${p.comprimento} × ${p.largura}` })),
        ferragens: [...ferr].map(([id, qtd]) => ({ nome: nomeFerr(id), qtd })),
      });
    }
  }

  const parede = m.ferragens.filter((f) => f.ferragemId === 'suporte-parede').reduce((s, f) => s + f.quantidade, 0);
  if (varios || parede) {
    passos.push({
      titulo: varios ? 'Una os módulos e fixe' : 'Fixe na parede',
      texto: [
        varios ? 'Encoste os módulos na posição do projeto e una com parafusos de 4 × 40 pelas laterais (4 por união). Onde a lateral é compartilhada, as cavilhas do módulo vizinho entram direto nela.' : '',
        parede ? 'Marque a altura na parede com nível, fure, coloque buchas e pendure nos suportes.' : '',
      ]
        .filter(Boolean)
        .join(' '),
      novas: [],
      visiveis: [...visiveis],
      pecas: [],
      ferragens: parede ? [{ nome: nomeFerr('suporte-parede'), qtd: parede }] : [],
    });
  }
  return passos;
}
