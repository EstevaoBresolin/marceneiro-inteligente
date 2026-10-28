import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { brl, fmtNum } from '../domain/money';
import type { Cliente, Empresa, Orcamento } from '../domain/types';
import { baixar, hex, slug, t, texto } from './exportar';

export type ItemOrcamento = { nome: string; descricao: string; medidas: string };

export type DadosOrcamento = {
  empresa: Empresa;
  cliente: Cliente;
  orcamento: Orcamento;
  projeto: string;
  imagemPng: string | null;
  itens: ItemOrcamento[];
  /** chapas, fitas e ferragens usadas, em linguagem de cliente */
  materiais: string[];
  totalCentavos: number;
};

const TINTA = hex('#22282b');
const CINZA = hex('#59646a');
const CLARO = hex('#8b959a');
const LINHA = hex('#d3d9d6');
const DESTAQUE = hex('#7e5a36');

export const numeroOrcamento = (n: number) => String(n).padStart(4, '0');

export function dataValidade(o: Orcamento) {
  const d = new Date(`${o.data}T12:00:00`);
  d.setDate(d.getDate() + o.validadeDias);
  return d.toLocaleDateString('pt-BR');
}

function quebrar(s: string, size: number, f: PDFFont, larg: number): string[] {
  const out: string[] = [];
  for (const par of t(s).split(/\n/)) {
    let atual = '';
    for (const w of par.split(' ')) {
      const tenta = atual ? `${atual} ${w}` : w;
      if (f.widthOfTextAtSize(tenta, size) > larg && atual) {
        out.push(atual);
        atual = w;
      } else atual = tenta;
    }
    out.push(atual);
  }
  return out;
}

export async function gerarPdfOrcamento(d: DadosOrcamento): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Orçamento ${numeroOrcamento(d.orcamento.numero)} - ${d.cliente.nome || d.projeto}`);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const [PW, PH] = [595.28, 841.89];
  const m = 44;
  const larg = PW - 2 * m;
  let page: PDFPage = doc.addPage([PW, PH]);
  let y = PH - m;

  const rodape = (p: PDFPage) => {
    const e = d.empresa;
    const linha = [e.nome, e.telefone && `WhatsApp ${e.telefone}`, e.email, e.cidade].filter(Boolean).join('  ·  ');
    p.drawLine({ start: { x: m, y: 34 }, end: { x: PW - m, y: 34 }, thickness: 0.5, color: LINHA });
    texto(p, linha, m, 22, 8, fonte, CLARO);
  };
  const espaco = (alt: number) => {
    if (y - alt < 60) {
      rodape(page);
      page = doc.addPage([PW, PH]);
      y = PH - m;
    }
  };

  // ---------- cabeçalho ----------
  let xNome = m;
  if (d.empresa.logo) {
    try {
      const img = await doc.embedPng(d.empresa.logo);
      const k = Math.min(110 / img.width, 54 / img.height);
      page.drawImage(img, { x: m, y: y - img.height * k, width: img.width * k, height: img.height * k });
      xNome = m + img.width * k + 14;
    } catch {
      /* logo inválido: segue sem */
    }
  }
  texto(page, d.empresa.nome || 'Sua marcenaria', xNome, y - 16, 15, negrito);
  const contato = [d.empresa.telefone && `WhatsApp ${d.empresa.telefone}`, d.empresa.email].filter(Boolean).join('  ·  ');
  if (contato) texto(page, contato, xNome, y - 31, 9, fonte, CINZA);
  const end2 = [d.empresa.endereco, d.empresa.cidade].filter(Boolean).join(' - ');
  if (end2) texto(page, end2, xNome, y - 43, 9, fonte, CINZA);
  if (d.empresa.documento) texto(page, `CNPJ/CPF ${d.empresa.documento}`, xNome, y - 55, 9, fonte, CINZA);

  const tituloDir = `Orçamento nº ${numeroOrcamento(d.orcamento.numero)}`;
  texto(page, tituloDir, PW - m - negrito.widthOfTextAtSize(t(tituloDir), 13), y - 16, 13, negrito);
  const dataTxt = `Emitido em ${new Date(`${d.orcamento.data}T12:00:00`).toLocaleDateString('pt-BR')}`;
  texto(page, dataTxt, PW - m - fonte.widthOfTextAtSize(t(dataTxt), 9), y - 31, 9, fonte, CINZA);
  const valTxt = `Válido até ${dataValidade(d.orcamento)}`;
  texto(page, valTxt, PW - m - fonte.widthOfTextAtSize(t(valTxt), 9), y - 43, 9, fonte, CINZA);
  y -= 74;
  page.drawLine({ start: { x: m, y }, end: { x: PW - m, y }, thickness: 1, color: TINTA });
  y -= 20;

  // ---------- cliente ----------
  texto(page, 'Cliente', m, y, 9, negrito, CLARO);
  y -= 14;
  texto(page, d.cliente.nome || '—', m, y, 12, negrito);
  y -= 14;
  const cli = [d.cliente.telefone, d.cliente.email].filter(Boolean).join('  ·  ');
  if (cli) {
    texto(page, cli, m, y, 9.5, fonte, CINZA);
    y -= 12;
  }
  if (d.cliente.endereco) {
    for (const l of quebrar(`Local: ${d.cliente.endereco}`, 9.5, fonte, larg)) {
      texto(page, l, m, y, 9.5, fonte, CINZA);
      y -= 12;
    }
  }
  y -= 10;

  // ---------- projeto + imagem ----------
  texto(page, d.projeto, m, y, 14, negrito);
  y -= 10;
  if (d.imagemPng) {
    try {
      const img = await doc.embedPng(d.imagemPng);
      const k = Math.min(larg / img.width, 250 / img.height);
      const w = img.width * k;
      const h = img.height * k;
      page.drawImage(img, { x: m + (larg - w) / 2, y: y - h, width: w, height: h });
      y -= h + 14;
    } catch {
      /* sem imagem */
    }
  }

  // ---------- itens ----------
  if (d.itens.length) {
    espaco(40);
    texto(page, 'Itens', m, y, 9, negrito, CLARO);
    y -= 6;
    for (const it of d.itens) {
      const linhas = quebrar(it.descricao, 9, fonte, larg - 150);
      espaco(18 + linhas.length * 11);
      page.drawLine({ start: { x: m, y }, end: { x: PW - m, y }, thickness: 0.4, color: LINHA });
      y -= 14;
      texto(page, it.nome, m, y, 10.5, negrito);
      texto(page, it.medidas, PW - m - fonte.widthOfTextAtSize(t(it.medidas), 9.5), y, 9.5, fonte, CINZA);
      y -= 12;
      for (const l of linhas) {
        texto(page, l, m, y, 9, fonte, CINZA);
        y -= 11;
      }
    }
    page.drawLine({ start: { x: m, y: y + 2 }, end: { x: PW - m, y: y + 2 }, thickness: 0.4, color: LINHA });
    y -= 14;
  }

  // ---------- materiais ----------
  if (d.materiais.length) {
    espaco(20 + d.materiais.length * 12);
    texto(page, 'Materiais e acabamento', m, y, 9, negrito, CLARO);
    y -= 13;
    for (const l of d.materiais) {
      for (const q of quebrar(`•  ${l}`, 9.5, fonte, larg)) {
        texto(page, q, m, y, 9.5, fonte);
        y -= 12;
      }
    }
    y -= 8;
  }

  // ---------- valor ----------
  espaco(110);
  const o = d.orcamento;
  page.drawRectangle({ x: m, y: y - 64, width: larg, height: 64, color: hex('#f6efe6') });
  texto(page, 'Valor total', m + 14, y - 22, 10, negrito, DESTAQUE);
  const total = brl(d.totalCentavos);
  texto(page, total, m + 14, y - 48, 22, negrito);
  if (o.descontoAVistaPercent > 0) {
    const av = brl(Math.round(d.totalCentavos * (1 - o.descontoAVistaPercent / 100)));
    const l1 = `À vista: ${av}`;
    const l2 = `(${fmtNum(o.descontoAVistaPercent, o.descontoAVistaPercent % 1 ? 1 : 0)}% de desconto)`;
    texto(page, l1, PW - m - 14 - negrito.widthOfTextAtSize(t(l1), 13), y - 32, 13, negrito, DESTAQUE);
    texto(page, l2, PW - m - 14 - fonte.widthOfTextAtSize(t(l2), 9), y - 46, 9, fonte, CINZA);
  }
  y -= 84;

  // ---------- condições ----------
  const cond: [string, string][] = [
    ['Pagamento', o.formaPagamento],
    ['Prazo de entrega', `${o.prazoEntregaDias} dias após a aprovação e a confirmação das medidas`],
    ['Validade', `${o.validadeDias} dias (até ${dataValidade(o)})`],
  ];
  for (const [k, v] of cond) {
    if (!v) continue;
    const ls = quebrar(v, 9.5, fonte, larg - 110);
    espaco(ls.length * 12 + 6);
    texto(page, k, m, y, 9.5, negrito, CINZA);
    for (const l of ls) {
      texto(page, l, m + 110, y, 9.5, fonte);
      y -= 12;
    }
    y -= 4;
  }
  if (o.observacoes.trim()) {
    const ls = quebrar(o.observacoes, 9.5, fonte, larg - 110);
    espaco(ls.length * 12 + 6);
    texto(page, 'Observações', m, y, 9.5, negrito, CINZA);
    for (const l of ls) {
      texto(page, l, m + 110, y, 9.5, fonte);
      y -= 12;
    }
  }

  // ---------- assinaturas ----------
  // assinaturas: precisam de ~50 pt acima do rodapé
  if (y - 40 < 52) {
    rodape(page);
    page = doc.addPage([PW, PH]);
    y = 140;
  }
  y -= 40;
  const w = (larg - 40) / 2;
  for (const [i, nome] of [d.empresa.nome || 'Marcenaria', `De acordo: ${d.cliente.nome || 'Cliente'}`].entries()) {
    const x = m + i * (w + 40);
    page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.6, color: CINZA });
    texto(page, nome, x, y - 12, 9, fonte, CINZA);
  }

  rodape(page);
  return doc.save();
}

export async function baixarOrcamento(d: DadosOrcamento) {
  const bytes = await gerarPdfOrcamento(d);
  const quem = d.cliente.nome ? `-${slug(d.cliente.nome)}` : '';
  baixar(bytes, `orcamento-${numeroOrcamento(d.orcamento.numero)}${quem}.pdf`, 'application/pdf');
}

