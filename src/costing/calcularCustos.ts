import { brl, fmtNum } from '../domain/money';
import { NOMES_FURO, type Catalogo, type Config, type Extra, type ItemFerragem, type Peca, type TipoFuro } from '../domain/types';
import type { PlanoCorte } from '../optimizer';

export type GrupoCusto = 'Chapa' | 'Fita de borda' | 'Corte' | 'Furação' | 'Ferragens' | 'Extras' | 'Mão de obra';

export const GRUPOS: GrupoCusto[] = ['Chapa', 'Fita de borda', 'Corte', 'Furação', 'Ferragens', 'Extras', 'Mão de obra'];

export type LinhaCusto = {
  grupo: GrupoCusto;
  descricao: string;
  /** a conta, por extenso, para o usuário ver de onde veio */
  conta: string;
  /** valor do lote inteiro, centavos */
  totalCentavos: number;
};

export type Custos = {
  lote: number;
  linhas: LinhaCusto[];
  porGrupo: Record<GrupoCusto, number>;
  totalLoteCentavos: number;
  unitarioCentavos: number;
  metrosFita: number;
  chapasUsadas: { nome: string; quantidade: number }[];
};

export type EntradaCustos = {
  pecas: Peca[];
  lote: number;
  ferragens: ItemFerragem[];
  extras: Extra[];
  horasMaoDeObra: number;
  plano: PlanoCorte;
  catalogo: Catalogo;
  config: Config;
};

const mStr = (m: number) => `${fmtNum(m)} m`;

export function calcularCustos(e: EntradaCustos): Custos {
  const { lote, catalogo, config, plano } = e;
  const s = config.servico;
  const linhas: LinhaCusto[] = [];
  const pecasCorte = e.pecas.filter((p) => !p.somente3d);

  // ---------------- Chapas ----------------
  for (const g of plano.grupos) {
    const chapa = catalogo.chapas.find((c) => c.id === g.chapa.id);
    if (!chapa || g.chapas.length === 0) continue;
    const n = g.chapas.length;
    // o plano pode ter escolhido outro tamanho do mesmo material
    const areaChapa = g.chapa.largura * g.chapa.altura;
    const preco = g.chapa.precoCentavos ?? chapa.precoCentavos;
    const tam = `${g.chapa.largura}×${g.chapa.altura}`;
    const areaPecas = g.chapas.reduce((acc, c) => acc + c.areaPecas, 0);
    if (s.chapaCobranca === 'inteiras') {
      linhas.push({
        grupo: 'Chapa',
        descricao: chapa.nome,
        conta: `${n} chapa(s) inteira(s) de ${tam} × ${brl(preco)}`,
        totalCentavos: n * preco,
      });
    } else {
      const fracao = (areaPecas / areaChapa) * (1 + s.perdaChapaPercent / 100);
      linhas.push({
        grupo: 'Chapa',
        descricao: chapa.nome,
        conta: `${fmtNum(areaPecas / 1e6, 3)} m² de peças ÷ ${fmtNum(areaChapa / 1e6, 3)} m² da chapa ${tam} + ${s.perdaChapaPercent}% de perda = ${fmtNum(fracao, 3)} chapa × ${brl(preco)} (plano usa ${n} chapa(s))`,
        totalCentavos: Math.round(fracao * preco),
      });
    }
  }

  // ---------------- Fita de borda ----------------
  const metrosPorFita = new Map<string, number>();
  for (const p of pecasCorte) {
    const lados: [string | null, number][] = [
      [p.bordas.c1, p.comprimento],
      [p.bordas.c2, p.comprimento],
      [p.bordas.l1, p.largura],
      [p.bordas.l2, p.largura],
    ];
    for (const [fitaId, mm] of lados) {
      if (!fitaId) continue;
      metrosPorFita.set(fitaId, (metrosPorFita.get(fitaId) ?? 0) + (mm * p.quantidade * lote) / 1000);
    }
  }
  let metrosFita = 0;
  for (const [fitaId, metros] of metrosPorFita) {
    const fita = catalogo.fitas.find((f) => f.id === fitaId);
    if (!fita) continue;
    metrosFita += metros;
    const comPerda = metros * (1 + s.perdaFitaPercent / 100);
    linhas.push({
      grupo: 'Fita de borda',
      descricao: fita.nome,
      conta: `${mStr(metros)} + ${s.perdaFitaPercent}% de perda = ${mStr(comPerda)} × ${brl(fita.precoMetroCentavos)}/m`,
      totalCentavos: Math.round(comPerda * fita.precoMetroCentavos),
    });
  }
  if (metrosFita > 0 && s.coladeiraPrecoMetroCentavos > 0) {
    linhas.push({
      grupo: 'Fita de borda',
      descricao: 'Aplicação da fita (coladeira)',
      conta: `${mStr(metrosFita)} × ${brl(s.coladeiraPrecoMetroCentavos)}/m`,
      totalCentavos: Math.round(metrosFita * s.coladeiraPrecoMetroCentavos),
    });
  }

  // ---------------- Corte ----------------
  const totalPecasCortadas = plano.grupos.reduce((a, g) => a + g.totalPecas, 0);
  const metrosCorte = plano.grupos.reduce((a, g) => a + g.metrosCorte, 0);
  const totalChapas = plano.grupos.reduce((a, g) => a + g.chapas.length, 0);
  if (s.corteModo === 'por_peca' && totalPecasCortadas > 0)
    linhas.push({ grupo: 'Corte', descricao: 'Corte por peça', conta: `${totalPecasCortadas} peças × ${brl(s.cortePrecoCentavos)}`, totalCentavos: totalPecasCortadas * s.cortePrecoCentavos });
  if (s.corteModo === 'por_metro_linear' && metrosCorte > 0)
    linhas.push({ grupo: 'Corte', descricao: 'Corte por metro linear', conta: `${mStr(metrosCorte)} de corte × ${brl(s.cortePrecoCentavos)}/m`, totalCentavos: Math.round(metrosCorte * s.cortePrecoCentavos) });
  if (s.corteModo === 'por_chapa' && totalChapas > 0)
    linhas.push({ grupo: 'Corte', descricao: 'Corte por chapa', conta: `${totalChapas} chapa(s) × ${brl(s.cortePrecoCentavos)}`, totalCentavos: totalChapas * s.cortePrecoCentavos });

  // ---------------- Furação ----------------
  const furos = new Map<TipoFuro, number>();
  for (const p of pecasCorte) for (const f of p.furos) furos.set(f.tipo, (furos.get(f.tipo) ?? 0) + f.quantidade * p.quantidade * lote);
  for (const [tipo, qtd] of furos) {
    const preco = s.furoPrecos[tipo] ?? 0;
    if (qtd === 0) continue;
    linhas.push({ grupo: 'Furação', descricao: NOMES_FURO[tipo], conta: `${qtd} furo(s) × ${brl(preco)}`, totalCentavos: qtd * preco });
  }

  // ---------------- Ferragens ----------------
  for (const item of e.ferragens) {
    const fer = catalogo.ferragens.find((f) => f.id === item.ferragemId);
    if (!fer || item.quantidade <= 0) continue;
    const qtd = item.quantidade * lote;
    linhas.push({ grupo: 'Ferragens', descricao: fer.nome, conta: `${fmtNum(qtd, qtd % 1 ? 2 : 0)} ${fer.unidade} × ${brl(fer.precoCentavos)}`, totalCentavos: Math.round(qtd * fer.precoCentavos) });
  }

  // ---------------- Extras ----------------
  for (const x of e.extras) {
    if (x.custoCentavos <= 0) continue;
    linhas.push({ grupo: 'Extras', descricao: x.descricao, conta: `${x.detalhe ? x.detalhe + ' → ' : ''}${brl(x.custoCentavos)} × ${lote} un.`, totalCentavos: x.custoCentavos * lote });
  }

  // ---------------- Mão de obra ----------------
  if (e.horasMaoDeObra > 0)
    linhas.push({
      grupo: 'Mão de obra',
      descricao: 'Montagem / acabamento',
      conta: `${fmtNum(e.horasMaoDeObra)} h × ${lote} un. × ${brl(s.maoDeObraHoraCentavos)}/h`,
      totalCentavos: Math.round(e.horasMaoDeObra * lote * s.maoDeObraHoraCentavos),
    });

  const porGrupo = Object.fromEntries(GRUPOS.map((g) => [g, 0])) as Record<GrupoCusto, number>;
  for (const l of linhas) porGrupo[l.grupo] += l.totalCentavos;
  const totalLoteCentavos = linhas.reduce((a, l) => a + l.totalCentavos, 0);

  return {
    lote,
    linhas,
    porGrupo,
    totalLoteCentavos,
    unitarioCentavos: Math.round(totalLoteCentavos / Math.max(1, lote)),
    metrosFita,
    chapasUsadas: plano.grupos.map((g) => ({ nome: g.chapa.nome, quantidade: g.chapas.length })),
  };
}
