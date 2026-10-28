/**
 * Exportação para seccionadora / CNC.
 * - CSV configurável (separador, decimal, colunas e ordem), com modelos de partida.
 * - DXF (R12, ASCII) por peça: contorno, furos de face em camadas por diâmetro/profundidade,
 *   furos de topo como retângulos informativos, e um ZIP com todas as peças.
 */
import type { Catalogo, Peca } from '../domain/types';
import { faceDeReferencia, type Furo } from '../domain/usinagem';

export type ColunaCsv = 'numero' | 'rotulo' | 'comprimento' | 'largura' | 'quantidade' | 'material' | 'espessura' | 'veio' | 'fitaC1' | 'fitaC2' | 'fitaL1' | 'fitaL2';

export type ConfigCsv = {
  modelo: string;
  separador: ';' | ',' | '\t';
  decimal: ',' | '.';
  cabecalho: boolean;
  /** cabeçalho em português ou inglês */
  idioma: 'pt' | 'en';
  colunas: ColunaCsv[];
  /** como escrever a fita de cada lado e o veio */
  fitaComo: 'nome' | 'sim_nao' | '1_0';
  veioComo: 'sim_nao' | '1_0';
};

export const NOMES_COLUNA: Record<ColunaCsv, { pt: string; en: string }> = {
  numero: { pt: 'Nº', en: 'No' },
  rotulo: { pt: 'Peça', en: 'Label' },
  comprimento: { pt: 'Comprimento', en: 'Length' },
  largura: { pt: 'Largura', en: 'Width' },
  quantidade: { pt: 'Quantidade', en: 'Qty' },
  material: { pt: 'Material', en: 'Material' },
  espessura: { pt: 'Espessura', en: 'Thickness' },
  veio: { pt: 'Respeita veio', en: 'Grain' },
  fitaC1: { pt: 'Fita C1', en: 'Band L1' },
  fitaC2: { pt: 'Fita C2', en: 'Band L2' },
  fitaL1: { pt: 'Fita L1', en: 'Band W1' },
  fitaL2: { pt: 'Fita L2', en: 'Band W2' },
};

export const MODELOS_CSV: { id: string; nome: string; dica: string; cfg: Omit<ConfigCsv, 'modelo'> }[] = [
  {
    id: 'completo',
    nome: 'Completo (Excel)',
    dica: 'Todas as colunas, ponto e vírgula e vírgula decimal: abre direto no Excel em português.',
    cfg: { separador: ';', decimal: ',', cabecalho: true, idioma: 'pt', colunas: ['numero', 'rotulo', 'comprimento', 'largura', 'quantidade', 'material', 'espessura', 'veio', 'fitaC1', 'fitaC2', 'fitaL1', 'fitaL2'], fitaComo: 'nome', veioComo: 'sim_nao' },
  },
  {
    id: 'ingles',
    nome: 'Otimizador em inglês',
    dica: 'Cabeçalho Length, Width, Qty, Material, Label…, vírgula como separador e ponto decimal. Comum em otimizadores importados; confira o modelo de importação do seu programa.',
    cfg: { separador: ',', decimal: '.', cabecalho: true, idioma: 'en', colunas: ['comprimento', 'largura', 'quantidade', 'material', 'rotulo', 'veio', 'fitaC1', 'fitaL1', 'fitaC2', 'fitaL2'], fitaComo: '1_0', veioComo: '1_0' },
  },
  {
    id: 'medidas',
    nome: 'Só medidas',
    dica: 'Quantidade; comprimento; largura; peça; material, sem cabeçalho. Bom ponto de partida para programas nacionais de corte.',
    cfg: { separador: ';', decimal: ',', cabecalho: false, idioma: 'pt', colunas: ['quantidade', 'comprimento', 'largura', 'rotulo', 'material'], fitaComo: '1_0', veioComo: '1_0' },
  },
];

export const CSV_PADRAO: ConfigCsv = { modelo: 'completo', ...MODELOS_CSV[0].cfg };

const num = (n: number, dec: ',' | '.') => {
  const s = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  return dec === ',' ? s.replace('.', ',') : s;
};

export function gerarCsv(pecas: Peca[], catalogo: Catalogo, cfg: ConfigCsv, lote = 1, numeros?: Map<string, string>): string {
  const sep = cfg.separador;
  const esc = (v: string) => (v.includes(sep) || /["\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const fitaNome = (id: string | null) => (id ? catalogo.fitas.find((f) => f.id === id)?.nome ?? id : '');
  const fita = (id: string | null) => (cfg.fitaComo === 'nome' ? fitaNome(id) : cfg.fitaComo === 'sim_nao' ? (id ? 'sim' : 'não') : id ? '1' : '0');
  const linhas: string[] = [];
  if (cfg.cabecalho) linhas.push(cfg.colunas.map((c) => esc(NOMES_COLUNA[c][cfg.idioma])).join(sep));
  for (const p of pecas) {
    if (p.somente3d || p.quantidade <= 0) continue;
    const ch = catalogo.chapas.find((c) => c.id === p.chapaId);
    const valores: Record<ColunaCsv, string> = {
      numero: numeros?.get(p.id) ?? '',
      rotulo: p.nome,
      comprimento: num(p.comprimento, cfg.decimal),
      largura: num(p.largura, cfg.decimal),
      quantidade: String(p.quantidade * lote),
      material: ch?.nome ?? '',
      espessura: ch ? num(ch.espessura, cfg.decimal) : '',
      veio: !p.podeGirar ? (cfg.veioComo === 'sim_nao' ? 'sim' : '1') : cfg.veioComo === 'sim_nao' ? 'não' : '0',
      fitaC1: fita(p.bordas.c1),
      fitaC2: fita(p.bordas.c2),
      fitaL1: fita(p.bordas.l1),
      fitaL2: fita(p.bordas.l2),
    };
    linhas.push(cfg.colunas.map((c) => esc(valores[c])).join(sep));
  }
  // BOM: o Excel abre com acentos certos
  return '﻿' + linhas.join('\r\n');
}

// ---------------------------------------------------------------------------
// DXF
// ---------------------------------------------------------------------------
const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

/** nome de camada aceito por qualquer CAD: só letras, números e _ */
export const camadaFuro = (diametro: number, prof: number | 'passante', verso: boolean) =>
  `${verso ? 'FURO_VERSO' : 'FURO'}_D${String(diametro).replace('.', '_')}_${prof === 'passante' ? 'PASSANTE' : `P${String(prof).replace('.', '_')}`}`;

export function gerarDxf(p: Peca, furos: Furo[], numero: string, espessura: number): string {
  const C = p.comprimento;
  const W = p.largura;
  const ref = faceDeReferencia(furos);
  const espelhado = ref === -1;
  const fx = (x: number) => (espelhado ? C - x : x);
  const ents: string[] = [];
  const camadas = new Set<string>(['CONTORNO', 'TEXTO', 'FITA']);
  const linha = (l: string, x1: number, y1: number, x2: number, y2: number) => ents.push('0', 'LINE', '8', l, '10', f(x1), '20', f(y1), '30', '0', '11', f(x2), '21', f(y2), '31', '0');
  const circulo = (l: string, x: number, y: number, r: number) => ents.push('0', 'CIRCLE', '8', l, '10', f(x), '20', f(y), '30', '0', '40', f(r));
  const texto = (l: string, x: number, y: number, h: number, t: string) => ents.push('0', 'TEXT', '8', l, '10', f(x), '20', f(y), '30', '0', '40', f(h), '1', t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, ''));

  // contorno (origem no canto L1 × C1, ou L2 × C1 se espelhado)
  linha('CONTORNO', 0, 0, C, 0);
  linha('CONTORNO', C, 0, C, W);
  linha('CONTORNO', C, W, 0, W);
  linha('CONTORNO', 0, W, 0, 0);

  // fitas de borda: linha 2 mm para fora, camada própria (informativa)
  const o = 2;
  if (p.bordas.c1) linha('FITA', 0, -o, C, -o);
  if (p.bordas.c2) linha('FITA', 0, W + o, C, W + o);
  const esq = (b: 'l1' | 'l2') => (b === 'l1') !== espelhado;
  for (const b of ['l1', 'l2'] as const) if (p.bordas[b]) linha('FITA', esq(b) ? -o : C + o, 0, esq(b) ? -o : C + o, W);

  for (const fu of furos) {
    if (fu.onde === 'face') {
      const verso = (fu.lado ?? 1) !== ref;
      const l = camadaFuro(fu.diametro, fu.profundidade, verso);
      camadas.add(l);
      circulo(l, fx(fu.x), fu.y, fu.diametro / 2);
    } else {
      // furo de topo: retângulo no contorno mostrando onde e quão fundo
      const prof = typeof fu.profundidade === 'number' ? fu.profundidade : 25;
      const l = `FURO_TOPO_D${String(fu.diametro).replace('.', '_')}_P${String(prof).replace('.', '_')}`;
      camadas.add(l);
      const d = fu.diametro / 2;
      if (fu.borda === 'l1' || fu.borda === 'l2') {
        const x0 = esq(fu.borda) ? 0 : C - prof;
        linha(l, x0, fu.y - d, x0 + prof, fu.y - d);
        linha(l, x0, fu.y + d, x0 + prof, fu.y + d);
      } else {
        const y0 = fu.borda === 'c1' ? 0 : W - prof;
        linha(l, fx(fu.x) - d, y0, fx(fu.x) - d, y0 + prof);
        linha(l, fx(fu.x) + d, y0, fx(fu.x) + d, y0 + prof);
      }
    }
  }
  texto('TEXTO', 0, -Math.max(12, W * 0.06) - 4, Math.max(8, Math.min(20, W * 0.05)), `${numero} ${p.nome} ${C}x${W}x${espessura}${espelhado ? ' (verso)' : ''}`);

  const tabelaCamadas = [...camadas].flatMap((nome, i) => ['0', 'LAYER', '2', nome, '70', '0', '62', String(nome === 'CONTORNO' ? 7 : nome === 'TEXTO' ? 8 : nome === 'FITA' ? 30 : nome.startsWith('FURO_TOPO') ? 4 : nome.startsWith('FURO_VERSO') ? 3 : 1 + (i % 5)), '6', 'CONTINUOUS']);
  return [
    '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '4', '9', '$MEASUREMENT', '70', '1',
    '9', '$EXTMIN', '10', '0', '20', '0', '9', '$EXTMAX', '10', f(C), '20', f(W), '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(camadas.size), ...tabelaCamadas, '0', 'ENDTAB', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES', ...ents, '0', 'ENDSEC', '0', 'EOF',
  ].join('\r\n');
}

const nomeArquivo = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

export async function zipDxf(itens: { peca: Peca; numero: string; quantidade: number; furos: Furo[] }[], catalogo: Catalogo): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import('fflate');
  const arquivos: Record<string, Uint8Array> = {};
  const leia: string[] = [
    'Arquivos DXF das peças (milímetros, vista pela face com mais furos).',
    '',
    'Camadas:',
    '  CONTORNO            contorno da peça',
    '  FURO_D8_P12         furo de face: diâmetro 8 mm, profundidade 12 mm (o nome traz as medidas)',
    '  FURO_VERSO_...      furo na outra face: virar a peça',
    '  FURO_TOPO_...       furo no topo (borda): só referência, não é feito na mesa da CNC',
    '  FITA                lado com fita de borda (informativo)',
    '  TEXTO               número, nome e medidas',
    '',
    'Peças:',
  ];
  for (const it of itens) {
    const esp = catalogo.chapas.find((c) => c.id === it.peca.chapaId)?.espessura ?? 0;
    const nome = `${nomeArquivo(it.numero.split(',')[0] || 'peca')}-${nomeArquivo(it.peca.nome)}-${it.peca.comprimento}x${it.peca.largura}.dxf`;
    arquivos[nome] = strToU8(gerarDxf(it.peca, it.furos, it.numero, esp));
    leia.push(`  ${nome}  quantidade ${it.quantidade}  (${it.numero})`);
  }
  arquivos['LEIA-ME.txt'] = strToU8(leia.join('\r\n'));
  return zipSync(arquivos, { level: 6 });
}
