import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { chaveLegenda, CORES_PECAS, legendaDoGrupo } from '../cutplan/DiagramaChapa';
import { textoBordas } from '../cutplan/PlanoCorteView';
import { GRUPOS, type Custos } from '../costing/calcularCustos';
import { precoSugerido } from '../costing/precoSugerido';
import { brl, fmtNum } from '../domain/money';
import type { Chapa, ConfigVenda, FitaBorda, Peca } from '../domain/types';
import type { PlanoCorte } from '../optimizer';

/** Helvetica (WinAnsi) não tem setas etc. */
export const t = (s: string) => s.replace(/[↻→↔↕]/g, '').replace(/[^\x20-\x7E -ÿ]/g, '');

export const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const TINTA = hex('#22282b');
const CINZA = hex('#59646a');
const CLARO = hex('#8b959a');
const MDF = hex('#b5895a');

export function baixar(dados: Uint8Array | string, nome: string, tipo: string) {
  const blob = new Blob([dados as BlobPart], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'projeto';

const hoje = () => new Date().toLocaleDateString('pt-BR');

export function texto(page: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = TINTA) {
  page.drawText(t(s), { x, y, size, font, color });
}

export function centrado(page: PDFPage, s: string, cx: number, cy: number, size: number, font: PDFFont, color = TINTA) {
  const w = font.widthOfTextAtSize(t(s), size);
  page.drawText(t(s), { x: cx - w / 2, y: cy - size * 0.35, size, font, color });
}

// ---------------------------------------------------------------------------
// PDF do plano de corte: 1 chapa por página (A4 paisagem)
// ---------------------------------------------------------------------------
export async function pdfPlanoCorte(opts: { projeto: string; plano: PlanoCorte; pecas: Peca[]; fitas: FitaBorda[]; lote: number }) {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const A4: [number, number] = [841.89, 595.28];
  const totalPaginas = opts.plano.grupos.reduce((s, g) => s + g.chapas.length, 0);
  let pagina = 0;

  for (const g of opts.plano.grupos) {
    const legenda = legendaDoGrupo(g);
    for (const ch of g.chapas) {
      pagina++;
      const page = doc.addPage(A4);
      const [PW, PH] = A4;
      const m = 32;

      texto(page, opts.projeto, m, PH - m - 6, 16, negrito);
      texto(page, `Plano de corte · ${hoje()} · lote de ${opts.lote} un.`, m, PH - m - 24, 10, fonte, CINZA);
      const dir = `Página ${pagina} de ${totalPaginas}`;
      texto(page, dir, PW - m - fonte.widthOfTextAtSize(dir, 10), PH - m - 6, 10, fonte, CINZA);
      texto(page, `${g.chapa.nome} · ${g.chapa.largura}×${g.chapa.altura} mm · chapa ${ch.indice + 1} de ${g.chapas.length}`, m, PH - m - 46, 12, negrito);
      texto(
        page,
        `${ch.pecas.length} peças · aproveitamento ${fmtNum(ch.aproveitamento * 100, 0)}% · ${fmtNum(ch.metrosCorte, 1)} m de corte · serra ${g.kerf} mm · refilo ${g.refilo} mm`,
        m,
        PH - m - 60,
        9,
        fonte,
        CINZA,
      );

      // área do desenho à esquerda, legenda à direita
      const legW = 230;
      const areaW = PW - 2 * m - legW - 16;
      const areaH = PH - 2 * m - 80;
      const esc = Math.min(areaW / g.chapa.largura, areaH / g.chapa.altura);
      const ox = m;
      const oy = m + (areaH - g.chapa.altura * esc);
      // y do PDF cresce para cima: converte
      const X = (x: number) => ox + x * esc;
      const Y = (y: number, h = 0) => oy + (g.chapa.altura - y - h) * esc;

      page.drawRectangle({ x: X(0), y: Y(0, g.chapa.altura), width: g.chapa.largura * esc, height: g.chapa.altura * esc, color: hex('#fbfaf7'), borderColor: MDF, borderWidth: 1.5 });
      for (const s of ch.sobras) {
        page.drawRectangle({ x: X(s.x), y: Y(s.y, s.h), width: s.w * esc, height: s.h * esc, color: hex('#f2ebe0'), borderColor: hex('#d4bfa3'), borderWidth: 0.5 });
        if (s.w * esc > 60 && s.h * esc > 14) centrado(page, `sobra ${s.w}×${s.h}`, X(s.x + s.w / 2), Y(s.y + s.h / 2), 7, fonte, hex('#8a6c4b'));
      }
      for (const p of ch.pecas) {
        const leg = legenda.get(chaveLegenda(p));
        page.drawRectangle({ x: X(p.x), y: Y(p.y, p.h), width: p.w * esc, height: p.h * esc, color: hex(leg?.cor ?? CORES_PECAS[0]), borderColor: hex('#5b4a39'), borderWidth: 0.8 });
        const w = p.w * esc;
        const h = p.h * esc;
        const cx = X(p.x + p.w / 2);
        const cy = Y(p.y + p.h / 2);
        const tamNum = Math.max(6, Math.min(14, Math.min(w, h) / 2.4));
        if (w > 30 && h > 22) {
          centrado(page, String(leg?.numero ?? '?'), cx, cy + 5, tamNum, negrito);
          centrado(page, p.rotacionada ? `${p.h}×${p.w}` : `${p.w}×${p.h}`, cx, cy - 7, Math.min(8, tamNum * 0.75), fonte, CINZA);
        } else if (w > 9 && h > 9) {
          centrado(page, String(leg?.numero ?? '?'), cx, cy, Math.min(tamNum, 8), negrito);
        }
      }

      // legenda
      let ly = PH - m - 96;
      const lx = PW - m - legW;
      texto(page, 'Peças', lx, ly, 11, negrito);
      ly -= 16;
      for (const [chave, { numero, cor, pecaId: pid }] of legenda) {
        const naChapa = ch.pecas.filter((p) => chaveLegenda(p) === chave);
        if (!naChapa.length) continue;
        const ex = naChapa[0];
        const peca = opts.pecas.find((p) => p.id === pid);
        page.drawRectangle({ x: lx, y: ly - 3, width: 13, height: 13, color: hex(cor) });
        centrado(page, String(numero), lx + 6.5, ly + 3.5, 8, negrito);
        texto(page, `${ex.rotulo}`, lx + 19, ly + 1, 9, negrito);
        const c = ex.rotacionada ? ex.h : ex.w;
        const l = ex.rotacionada ? ex.w : ex.h;
        texto(page, `${c} × ${l} mm   ×${naChapa.length}`, lx + 19, ly - 10, 8, fonte, CINZA);
        if (peca) texto(page, `Fita: ${textoBordas(peca, opts.fitas)}`, lx + 19, ly - 20, 7.5, fonte, CLARO);
        ly -= 34;
        if (ly < m + 40) break;
      }
      texto(page, 'C = lado do comprimento, L = lado da largura.', lx, m + 4, 7.5, fonte, CLARO);
    }
  }

  if (pagina === 0) doc.addPage(A4);
  baixar(await doc.save(), `plano-de-corte-${slug(opts.projeto)}.pdf`, 'application/pdf');
}

// ---------------------------------------------------------------------------
// PDF do orçamento / ficha técnica (A4 retrato)
// ---------------------------------------------------------------------------
export async function pdfOrcamento(opts: {
  projeto: string;
  imagemPng: string | null;
  dimensoes?: { largura: number; altura: number; profundidade: number };
  pecas: Peca[];
  chapas: Chapa[];
  fitas: FitaBorda[];
  custos: Custos;
  venda: ConfigVenda;
}) {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const [PW, PH] = [595.28, 841.89];
  let page = doc.addPage([PW, PH]);
  const m = 40;
  let y = PH - m;

  const novaPaginaSePreciso = (alt: number) => {
    if (y - alt < m) {
      page = doc.addPage([PW, PH]);
      y = PH - m;
    }
  };

  texto(page, opts.projeto, m, y - 14, 18, negrito);
  texto(page, `Ficha técnica e custos (uso interno) · ${hoje()}`, m, y - 32, 10, fonte, CINZA);
  y -= 50;

  if (opts.imagemPng) {
    try {
      const img = await doc.embedPng(opts.imagemPng);
      const maxW = PW - 2 * m;
      const maxH = 260;
      const esc = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * esc;
      const h = img.height * esc;
      page.drawImage(img, { x: m + (maxW - w) / 2, y: y - h, width: w, height: h });
      y -= h + 12;
    } catch {
      /* sem imagem */
    }
  }
  if (opts.dimensoes && opts.dimensoes.largura > 0) {
    const d = opts.dimensoes;
    texto(page, `Medidas externas: ${d.largura} (L) × ${d.altura} (A) × ${d.profundidade} (P) mm`, m, y - 10, 11, negrito);
    y -= 26;
  }

  // lista de peças
  texto(page, 'Peças (por unidade)', m, y - 10, 12, negrito);
  y -= 26;
  const cols = [m, m + 150, m + 300, m + 345, m + 380];
  ['Peça', 'Chapa', 'Medida (mm)', '', 'Qtd · Fita'].forEach((h, i) => h && texto(page, h, cols[i], y, 8.5, negrito, CINZA));
  y -= 4;
  page.drawLine({ start: { x: m, y }, end: { x: PW - m, y }, thickness: 0.5, color: hex('#d3d9d6') });
  y -= 12;
  for (const p of opts.pecas.filter((x) => !x.somente3d)) {
    novaPaginaSePreciso(16);
    texto(page, p.nome, cols[0], y, 9, fonte);
    texto(page, opts.chapas.find((c) => c.id === p.chapaId)?.nome ?? '—', cols[1], y, 9, fonte, CINZA);
    texto(page, `${p.comprimento} × ${p.largura}`, cols[2], y, 9, fonte);
    texto(page, `${p.quantidade} · ${textoBordas(p, opts.fitas)}`, cols[4], y, 9, fonte, CINZA);
    y -= 14;
  }
  y -= 12;

  // custos
  const c = opts.custos;
  novaPaginaSePreciso(60);
  texto(page, `Custos por unidade${c.lote > 1 ? ` (lote de ${c.lote})` : ''}`, m, y - 10, 12, negrito);
  y -= 28;
  for (const g of GRUPOS) {
    const linhas = c.linhas.filter((l) => l.grupo === g);
    if (!linhas.length) continue;
    novaPaginaSePreciso(18 + linhas.length * 22);
    texto(page, g, m, y, 10, negrito);
    const v = brl(Math.round(c.porGrupo[g] / c.lote));
    texto(page, v, PW - m - negrito.widthOfTextAtSize(t(v), 10), y, 10, negrito);
    y -= 13;
    for (const l of linhas) {
      texto(page, l.descricao, m + 10, y, 8.5, fonte);
      texto(page, l.conta.slice(0, 110), m + 10, y - 10, 7, fonte, CLARO);
      const vv = brl(Math.round(l.totalCentavos / c.lote));
      texto(page, vv, PW - m - fonte.widthOfTextAtSize(t(vv), 8.5), y, 8.5, fonte, CINZA);
      y -= 22;
    }
    y -= 2;
  }
  novaPaginaSePreciso(80);
  page.drawLine({ start: { x: m, y }, end: { x: PW - m, y }, thickness: 0.8, color: TINTA });
  y -= 18;
  const total = brl(c.unitarioCentavos);
  texto(page, 'Custo total por unidade', m, y, 12, negrito);
  texto(page, total, PW - m - negrito.widthOfTextAtSize(t(total), 12), y, 12, negrito);
  y -= 20;
  const sug = precoSugerido(c.unitarioCentavos, opts.venda);
  if (sug !== null) {
    const s = brl(sug);
    texto(page, `Preço sugerido (lucro ${fmtNum(opts.venda.margemDesejadaPercent, 0)}%, imposto ${fmtNum(opts.venda.impostoPercent, 1)}%, comissão ${fmtNum(opts.venda.comissaoPercent, 1)}%)`, m, y, 11, fonte);
    texto(page, s, PW - m - negrito.widthOfTextAtSize(t(s), 14), y, 14, negrito, hex('#2f5d7c'));
  }

  baixar(await doc.save(), `ficha-custos-${slug(opts.projeto)}.pdf`, 'application/pdf');
}

// ---------------------------------------------------------------------------
// CSV da lista de corte
// ---------------------------------------------------------------------------
export function csvListaCorte(projeto: string, pecas: Peca[], chapas: Chapa[], fitas: FitaBorda[], lote: number) {
  const fitaNome = (id: string | null) => (id ? fitas.find((f) => f.id === id)?.nome ?? id : '');
  const esc = (s: string | number) => {
    const v = String(s);
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const linhas = [
    ['Peça', 'Comprimento (mm)', 'Largura (mm)', 'Quantidade', 'Chapa', 'Espessura', 'Pode girar', 'Fita C1', 'Fita C2', 'Fita L1', 'Fita L2'],
    ...pecas
      .filter((p) => !p.somente3d)
      .map((p) => {
        const ch = chapas.find((c) => c.id === p.chapaId);
        return [p.nome, p.comprimento, p.largura, p.quantidade * lote, ch?.nome ?? '', ch?.espessura ?? '', p.podeGirar ? 'sim' : 'não', fitaNome(p.bordas.c1), fitaNome(p.bordas.c2), fitaNome(p.bordas.l1), fitaNome(p.bordas.l2)];
      }),
  ];
  // BOM para o Excel abrir com acentos; ; como separador (padrão pt-BR)
  const csv = '﻿' + linhas.map((l) => l.map(esc).join(';')).join('\r\n');
  baixar(csv, `lista-de-corte-${slug(projeto)}.csv`, 'text/csv;charset=utf-8');
}

// ---------------------------------------------------------------------------
// Desenhos das peças com furação (A4 retrato, 2 por página)
// ---------------------------------------------------------------------------
export type ItemDesenho = { peca: Peca; numero: string; quantidade: number; furos: import('../domain/usinagem').Furo[] };

export async function pdfDesenhos(opts: { projeto: string; itens: ItemDesenho[]; chapas: Chapa[]; fitas: FitaBorda[] }) {
  const { geometriaDesenho } = await import('../cutplan/desenho');
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const [PW, PH] = [595.28, 841.89];
  const m = 36;
  const alturaBloco = (PH - 2 * m - 30) / 2;

  for (let i = 0; i < opts.itens.length; i++) {
    const slot = i % 2;
    const page = slot === 0 ? doc.addPage([PW, PH]) : doc.getPages()[doc.getPageCount() - 1];
    if (slot === 0) {
      texto(page, opts.projeto, m, PH - m - 8, 13, negrito);
      texto(page, `Desenhos das peças · ${hoje()} · medidas em mm`, m, PH - m - 22, 9, fonte, CINZA);
    }
    const it = opts.itens[i];
    const g = geometriaDesenho(it.peca, it.furos);
    const chapa = opts.chapas.find((c) => c.id === it.peca.chapaId);
    const topo = PH - m - 34 - slot * alturaBloco;

    // cabeçalho do bloco
    page.drawRectangle({ x: m, y: topo - 16, width: negrito.widthOfTextAtSize(it.numero, 10) + 8, height: 15, color: TINTA });
    texto(page, it.numero, m + 4, topo - 12, 10, negrito, rgb(1, 1, 1));
    texto(page, `${it.peca.nome}${it.quantidade > 1 ? `  ×${it.quantidade}` : ''}`, m + negrito.widthOfTextAtSize(it.numero, 10) + 14, topo - 12, 11, negrito);
    const dims = `${g.C} × ${g.W} × ${chapa?.espessura ?? '?'} mm · ${chapa?.nome ?? ''}`;
    texto(page, dims, PW - m - fonte.widthOfTextAtSize(t(dims), 9), topo - 12, 9, fonte, CINZA);

    // desenho
    const linhasTabela = g.tabela.length;
    const areaH = alturaBloco - 70 - linhasTabela * 12;
    const areaW = PW - 2 * m - 60;
    const esc = Math.min(areaW / g.C, Math.max(40, areaH) / g.W);
    const ox = m + 40 + (areaW - g.C * esc) / 2;
    const oy = topo - 30 - g.W * esc; // canto de baixo (C1)
    const X = (x: number) => ox + x * esc;
    const Y = (y: number) => oy + y * esc;
    page.drawRectangle({ x: X(0), y: Y(0), width: g.C * esc, height: g.W * esc, color: hex('#fbf7f0'), borderColor: hex('#5b4a39'), borderWidth: 0.8 });
    for (const b of g.fitas) {
      const esq = (b === 'l1') !== g.espelhado;
      const o = 2.2;
      const [s, e] =
        b === 'c1' ? [{ x: X(0), y: Y(0) - o }, { x: X(g.C), y: Y(0) - o }] : b === 'c2' ? [{ x: X(0), y: Y(g.W) + o }, { x: X(g.C), y: Y(g.W) + o }] : esq ? [{ x: X(0) - o, y: Y(0) }, { x: X(0) - o, y: Y(g.W) }] : [{ x: X(g.C) + o, y: Y(0) }, { x: X(g.C) + o, y: Y(g.W) }];
      page.drawLine({ start: s, end: e, thickness: 2.5, color: MDF });
    }
    for (const b of ['c1', 'c2', 'l1', 'l2'] as const) {
      const esq = (b === 'l1') !== g.espelhado;
      const pos = b === 'c1' ? { x: X(g.C / 2), y: Y(0) - 11 } : b === 'c2' ? { x: X(g.C / 2), y: Y(g.W) + 9 } : { x: esq ? X(0) - 12 : X(g.C) + 12, y: Y(g.W / 2) };
      centrado(page, b.toUpperCase(), pos.x, pos.y, 7, negrito, g.fitas.includes(b) ? hex('#7e5a36') : CLARO);
    }
    for (const tp of g.topos) page.drawRectangle({ x: X(tp.x), y: Y(tp.y), width: Math.max(1.5, tp.w * esc), height: Math.max(1.5, tp.h * esc), borderColor: hex(tp.cor), borderWidth: 0.6, borderDashArray: [2, 1.5] });
    for (const f of g.furos) {
      page.drawCircle({ x: X(f.x), y: Y(f.y), size: Math.max(1.6, f.r * esc), borderColor: hex(f.cor), borderWidth: 0.8, color: f.faceVisivel ? rgb(1, 1, 1) : undefined, borderDashArray: f.faceVisivel ? undefined : [1.6, 1.2] });
      page.drawCircle({ x: X(f.x), y: Y(f.y), size: 0.5, color: hex(f.cor) });
    }
    // cotas gerais
    page.drawLine({ start: { x: X(0), y: Y(0) - 22 }, end: { x: X(g.C), y: Y(0) - 22 }, thickness: 0.5, color: CINZA });
    centrado(page, String(g.C), X(g.C / 2), Y(0) - 30, 8, negrito);
    page.drawLine({ start: { x: X(0) - 26, y: Y(0) }, end: { x: X(0) - 26, y: Y(g.W) }, thickness: 0.5, color: CINZA });
    texto(page, String(g.W), X(0) - 38 - negrito.widthOfTextAtSize(String(g.W), 8) / 2, Y(g.W / 2) - 3, 8, negrito);

    // notas + tabela de furos
    let ty = Y(0) - 46;
    const nota = `${g.fitas.length ? `Fita em ${g.fitas.map((b) => b.toUpperCase()).join(', ')}` : 'Sem fita'}${g.espelhado ? ' · vista pela face de trás' : ''} · tracejado = furo na outra face`;
    texto(page, nota, m, ty, 7.5, fonte, CLARO);
    ty -= 13;
    for (const l of g.tabela) {
      page.drawCircle({ x: m + 3, y: ty + 2.5, size: 2.5, color: hex(l.cor) });
      texto(page, `${l.qtd}× ${l.tipo}`, m + 10, ty, 8, negrito);
      texto(page, l.onde, m + 150, ty, 8, fonte, CINZA);
      texto(page, l.medida, m + 230, ty, 8, fonte, CINZA);
      texto(page, l.pos.slice(0, 70), m + 320, ty, 8, fonte, CLARO);
      ty -= 12;
    }
    if (!g.tabela.length) texto(page, 'Sem furação.', m, ty, 8, fonte, CLARO);
    if (slot === 0) page.drawLine({ start: { x: m, y: topo - alturaBloco + 6 }, end: { x: PW - m, y: topo - alturaBloco + 6 }, thickness: 0.4, color: hex('#d3d9d6') });
  }
  if (!opts.itens.length) doc.addPage([PW, PH]);
  baixar(await doc.save(), `desenhos-${slug(opts.projeto)}.pdf`, 'application/pdf');
}

// ---------------------------------------------------------------------------
// Manual de montagem (A4 retrato, 2 passos por página)
// ---------------------------------------------------------------------------
export async function pdfManual(opts: { projeto: string; passos: import('../domain/manual').Passo[]; imagens: (string | null)[]; listaPecas: { numero: string; nome: string; medida: string }[] }) {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const [PW, PH] = [595.28, 841.89];
  const m = 40;

  // capa: lista de peças
  let page = doc.addPage([PW, PH]);
  texto(page, opts.projeto, m, PH - m - 14, 20, negrito);
  texto(page, `Manual de montagem · ${opts.passos.length} passos · ${hoje()}`, m, PH - m - 34, 10, fonte, CINZA);
  if (opts.imagens.length && opts.imagens[opts.imagens.length - 1]) {
    try {
      const img = await doc.embedPng(opts.imagens[opts.imagens.length - 1]!);
      const w = PW - 2 * m;
      const h = Math.min(300, (img.height * w) / img.width);
      const k = Math.min(w / img.width, h / img.height);
      page.drawImage(img, { x: m + (w - img.width * k) / 2, y: PH - m - 50 - img.height * k, width: img.width * k, height: img.height * k });
    } catch {
      /* sem imagem */
    }
  }
  let y = PH - m - 370;
  texto(page, 'Peças', m, y, 12, negrito);
  y -= 16;
  for (const p of opts.listaPecas) {
    if (y < m + 10) {
      page = doc.addPage([PW, PH]);
      y = PH - m;
    }
    texto(page, p.numero, m, y, 9, negrito);
    texto(page, p.nome, m + 34, y, 9, fonte);
    texto(page, p.medida, m + 300, y, 9, fonte, CINZA);
    y -= 13;
  }

  const blocoH = (PH - 2 * m) / 2;
  for (let i = 0; i < opts.passos.length; i++) {
    const slot = i % 2;
    if (slot === 0) page = doc.addPage([PW, PH]);
    const ps = opts.passos[i];
    const topo = PH - m - slot * blocoH;
    page.drawCircle({ x: m + 11, y: topo - 10, size: 11, color: hex('#b5641f') });
    centrado(page, String(i + 1), m + 11, topo - 10, 11, negrito, rgb(1, 1, 1));
    texto(page, ps.titulo, m + 30, topo - 14, 13, negrito);
    // imagem na largura toda, texto embaixo
    const imgW = PW - 2 * m;
    const imgH = blocoH - 150;
    let usado = 0;
    const src = opts.imagens[i];
    if (src) {
      try {
        const img = await doc.embedPng(src);
        const k = Math.min(imgW / img.width, imgH / img.height);
        usado = img.height * k;
        page.drawImage(img, { x: m + (imgW - img.width * k) / 2, y: topo - 30 - usado, width: img.width * k, height: usado });
      } catch {
        /* sem imagem */
      }
    }
    const tx = m;
    const larg = PW - 2 * m;
    let ty = topo - 46 - usado;
    const quebrar = (s: string, size: number, f: PDFFont) => {
      const linhas: string[] = [];
      let atual = '';
      for (const w of t(s).split(' ')) {
        const tenta = atual ? `${atual} ${w}` : w;
        if (f.widthOfTextAtSize(tenta, size) > larg) {
          linhas.push(atual);
          atual = w;
        } else atual = tenta;
      }
      if (atual) linhas.push(atual);
      return linhas;
    };
    for (const l of quebrar(ps.texto, 9.5, fonte)) {
      texto(page, l, tx, ty, 9.5, fonte);
      ty -= 13;
    }
    ty -= 6;
    const yLista = ty;
    if (ps.pecas.length) {
      texto(page, 'Peças', tx, ty, 9, negrito, CINZA);
      ty -= 12;
      for (const p of ps.pecas.slice(0, 8)) {
        texto(page, `${p.numero}  ${p.nome}  (${p.medida})`.slice(0, 52), tx, ty, 8.5, fonte);
        ty -= 11;
      }
      if (ps.pecas.length > 8) texto(page, `+ ${ps.pecas.length - 8} peças`, tx, ty, 8.5, fonte, CLARO);
    }
    if (ps.ferragens.length) {
      let fy = yLista;
      const fx = m + larg / 2 + 10;
      texto(page, 'Ferragens', fx, fy, 9, negrito, CINZA);
      fy -= 12;
      for (const f of ps.ferragens.slice(0, 8)) {
        texto(page, `${f.qtd}× ${f.nome}`.slice(0, 48), fx, fy, 8.5, fonte);
        fy -= 11;
      }
    }
    if (slot === 0) page.drawLine({ start: { x: m, y: topo - blocoH + 4 }, end: { x: PW - m, y: topo - blocoH + 4 }, thickness: 0.4, color: hex('#d3d9d6') });
  }
  baixar(await doc.save(), `manual-${slug(opts.projeto)}.pdf`, 'application/pdf');
}
