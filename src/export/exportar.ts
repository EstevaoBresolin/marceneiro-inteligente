import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { CORES_PECAS, legendaDoGrupo } from '../cutplan/DiagramaChapa';
import { textoBordas } from '../cutplan/PlanoCorteView';
import { GRUPOS, type Custos } from '../costing/calcularCustos';
import { precoSugerido } from '../costing/precoSugerido';
import { brl, fmtNum } from '../domain/money';
import type { Chapa, ConfigVenda, FitaBorda, Peca } from '../domain/types';
import type { PlanoCorte } from '../optimizer';

/** Helvetica (WinAnsi) não tem setas etc. */
const t = (s: string) => s.replace(/[↻→↔↕]/g, '').replace(/[^\x20-\x7E -ÿ]/g, '');

const hex = (h: string) => {
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

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'projeto';

const hoje = () => new Date().toLocaleDateString('pt-BR');

function texto(page: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = TINTA) {
  page.drawText(t(s), { x, y, size, font, color });
}

function centrado(page: PDFPage, s: string, cx: number, cy: number, size: number, font: PDFFont, color = TINTA) {
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
        const leg = legenda.get(p.pecaId);
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
      for (const [pid, { numero, cor }] of legenda) {
        const naChapa = ch.pecas.filter((p) => p.pecaId === pid);
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
  texto(page, `Ficha técnica e orçamento · ${hoje()}`, m, y - 32, 10, fonte, CINZA);
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
    texto(page, `Preço sugerido (margem ${fmtNum(opts.venda.margemDesejadaPercent, 0)}%, comissão ${fmtNum(opts.venda.comissaoMarketplacePercent, 1)}%)`, m, y, 11, fonte);
    texto(page, s, PW - m - negrito.widthOfTextAtSize(t(s), 14), y, 14, negrito, hex('#2f5d7c'));
  }

  baixar(await doc.save(), `orcamento-${slug(opts.projeto)}.pdf`, 'application/pdf');
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
