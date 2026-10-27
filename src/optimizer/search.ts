import { empacotar, sobraReal, type EscolhaChapa, type EscolhaEspaco, type Pack, type Parametros, type RegraDivisao } from './guillotine';
import type { ChapaResultado, EntradaOtimizador, PecaCorte, Retangulo, ResultadoCorte } from './types';

const ESCOLHAS: EscolhaEspaco[] = ['BAF', 'BSSF', 'BLSF'];
const DIVISOES: RegraDivisao[] = ['SLAS', 'LLAS', 'MINAS', 'MAXAS', 'SAS', 'LAS'];
const SELECOES: EscolhaChapa[] = ['global', 'primeira'];

/** sobras menores que isso não são listadas como reaproveitáveis */
export const SOBRA_MINIMA = 100;

type Ordenacao = { nome: string; chave: (p: PecaCorte) => number[] };

// Para peças que podem girar, ordena pela dimensão normalizada (lado maior primeiro)
const maior = (p: PecaCorte) => (p.podeGirar ? Math.max(p.w, p.h) : p.w);
const menorLado = (p: PecaCorte) => (p.podeGirar ? Math.min(p.w, p.h) : p.h);

const ORDENACOES: Ordenacao[] = [
  { nome: 'área', chave: (p) => [p.w * p.h, maior(p)] },
  { nome: 'maior lado', chave: (p) => [Math.max(p.w, p.h), Math.min(p.w, p.h)] },
  { nome: 'perímetro', chave: (p) => [p.w + p.h, maior(p)] },
  { nome: 'comprimento', chave: (p) => [maior(p), menorLado(p)] },
  { nome: 'largura', chave: (p) => [menorLado(p), maior(p)] },
];

function ordenar(pecas: PecaCorte[], o: Ordenacao): PecaCorte[] {
  return [...pecas].sort((a, b) => {
    const ka = o.chave(a);
    const kb = o.chave(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i];
    return a.rotulo.localeCompare(b.rotulo);
  });
}

type Avaliacao = { chapas: number; maiorSobra: number; cortes: number; ultimaUso: number };

function avaliar(pack: Pack, kerf: number): Avaliacao {
  let maiorSobra = 0;
  let cortes = 0;
  for (const ch of pack.chapas) {
    cortes += ch.cortes.length;
    for (const f of ch.livres) {
      const r = sobraReal(f, kerf);
      if (r.w >= SOBRA_MINIMA && r.h >= SOBRA_MINIMA) maiorSobra = Math.max(maiorSobra, r.w * r.h);
    }
  }
  const ultima = pack.chapas[pack.chapas.length - 1];
  const ultimaUso = ultima ? ultima.colocadas.reduce((s, c) => s + c.w * c.h, 0) : 0;
  return { chapas: pack.chapas.length, maiorSobra, cortes, ultimaUso };
}

/** true se a for melhor que b: menos chapas → maior sobra → menos cortes */
function melhorQue(a: Avaliacao, b: Avaliacao) {
  if (a.chapas !== b.chapas) return a.chapas < b.chapas;
  if (a.maiorSobra !== b.maiorSobra) return a.maiorSobra > b.maiorSobra;
  return a.cortes < b.cortes;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function otimizar(entrada: EntradaOtimizador): ResultadoCorte {
  const { chapa, kerf, refilo } = entrada;
  const tempoMs = entrada.tempoMs ?? 1500;
  const rnd = mulberry32(entrada.seed ?? 12345);
  const W = chapa.largura - 2 * refilo;
  const H = chapa.altura - 2 * refilo;

  // Se a chapa tem veio, nenhuma peça gira (o veio manda)
  const pecas = entrada.pecas.map((p) => ({ ...p, podeGirar: p.podeGirar && !chapa.temVeio }));

  const inicio = agora();
  let melhorPack: Pack | null = null;
  let melhorAval: Avaliacao | null = null;
  let melhorOrdem: PecaCorte[] = pecas;
  let melhorParams: Parametros = { escolha: 'BSSF', divisao: 'SLAS', chapaSel: 'global' };
  let estrategia = '';
  let iteracoes = 0;

  const tentar = (ordem: PecaCorte[], params: Parametros, nome: string) => {
    iteracoes++;
    const pack = empacotar(ordem, W, H, kerf, params);
    const av = avaliar(pack, kerf);
    if (!melhorAval || melhorQue(av, melhorAval)) {
      melhorPack = pack;
      melhorAval = av;
      melhorOrdem = ordem;
      melhorParams = params;
      estrategia = nome;
      return true;
    }
    return false;
  };

  // Fase 1: todas as combinações determinísticas
  for (const o of ORDENACOES) {
    const ordem = ordenar(pecas, o);
    for (const escolha of ESCOLHAS)
      for (const divisao of DIVISOES)
        for (const chapaSel of SELECOES)
          tentar(ordem, { escolha, divisao, chapaSel }, `${o.nome} · ${escolha} · ${divisao} · ${chapaSel}`);
  }

  // Fase 2: busca local (trocas na ordem) até acabar o tempo
  const n = pecas.length;
  if (n > 2) {
    let ordemAtual = melhorOrdem;
    let paramsAtual = melhorParams;
    let avAtual = melhorAval!;
    let semMelhora = 0;
    while (agora() - inicio < tempoMs && iteracoes < 200000) {
      const nova = [...ordemAtual];
      const movimentos = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < movimentos; k++) {
        const i = Math.floor(rnd() * n);
        const j = Math.floor(rnd() * n);
        [nova[i], nova[j]] = [nova[j], nova[i]];
      }
      const params: Parametros =
        rnd() < 0.2
          ? {
              escolha: ESCOLHAS[Math.floor(rnd() * ESCOLHAS.length)],
              divisao: DIVISOES[Math.floor(rnd() * DIVISOES.length)],
              chapaSel: SELECOES[Math.floor(rnd() * SELECOES.length)],
            }
          : paramsAtual;
      iteracoes++;
      const pack = empacotar(nova, W, H, kerf, params);
      const av = avaliar(pack, kerf);
      // aceita igual ou melhor (anda pelo platô); guarda o melhor global
      if (!melhorQue(avAtual, av)) {
        ordemAtual = nova;
        paramsAtual = params;
        avAtual = av;
      }
      if (melhorQue(av, melhorAval!)) {
        melhorPack = pack;
        melhorAval = av;
        melhorOrdem = nova;
        melhorParams = params;
        estrategia = `busca local (${params.escolha} · ${params.divisao})`;
        semMelhora = 0;
      } else if (++semMelhora > 4000) {
        // reinicia a partir do melhor global
        ordemAtual = melhorOrdem;
        semMelhora = 0;
      }
    }
  }

  return montarResultado(melhorPack ?? { chapas: [], naoCabem: [] }, entrada, estrategia, iteracoes);
}

function montarResultado(pack: Pack, entrada: EntradaOtimizador, estrategia: string, iteracoes: number): ResultadoCorte {
  const { chapa, kerf, refilo } = entrada;
  const areaChapa = chapa.largura * chapa.altura;
  const chapas: ChapaResultado[] = pack.chapas.map((ch, indice) => {
    const pecas = ch.colocadas.map((c) => ({
      pecaId: c.peca.pecaId,
      rotulo: c.peca.rotulo,
      x: c.x + refilo,
      y: c.y + refilo,
      w: c.w,
      h: c.h,
      rotacionada: c.rotacionada,
    }));
    const sobras: Retangulo[] = ch.livres
      .map((f) => sobraReal(f, kerf))
      .filter((r) => r.w >= SOBRA_MINIMA && r.h >= SOBRA_MINIMA)
      .map((r) => ({ ...r, x: r.x + refilo, y: r.y + refilo }))
      .sort((a, b) => b.w * b.h - a.w * a.h);
    const cortes = ch.cortes.map((c, i) => ({ ...c, x: c.x + refilo, y: c.y + refilo, ordem: i + 1 }));
    const areaPecas = pecas.reduce((s, p) => s + p.w * p.h, 0);
    return {
      indice,
      pecas,
      sobras,
      cortes,
      areaPecas,
      aproveitamento: areaPecas / areaChapa,
      metrosCorte: cortes.reduce((s, c) => s + c.comprimento, 0) / 1000,
    };
  });

  const totalArea = chapas.reduce((s, c) => s + c.areaPecas, 0);
  let maiorSobra: Retangulo | null = null;
  let areaSobra = 0;
  for (const c of chapas)
    for (const s of c.sobras) {
      areaSobra += s.w * s.h;
      if (!maiorSobra || s.w * s.h > maiorSobra.w * maiorSobra.h) maiorSobra = s;
    }

  return {
    chapa,
    kerf,
    refilo,
    chapas,
    naoCabem: pack.naoCabem,
    totalPecas: chapas.reduce((s, c) => s + c.pecas.length, 0),
    aproveitamentoMedio: chapas.length ? totalArea / (areaChapa * chapas.length) : 0,
    metrosCorte: chapas.reduce((s, c) => s + c.metrosCorte, 0),
    numCortes: chapas.reduce((s, c) => s + c.cortes.length, 0),
    areaSobra,
    maiorSobra,
    estrategia,
    iteracoes,
  };
}
