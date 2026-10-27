import { describe, expect, it } from 'vitest';
import { CATALOGO_PADRAO, CONFIG_PADRAO } from '../domain/defaults';
import type { Config, Peca } from '../domain/types';
import { planejarCorte } from '../optimizer';
import { calcularCustos } from './calcularCustos';
import { precoSugerido, simularVenda } from './precoSugerido';

const venda = { comissaoMarketplacePercent: 16, taxaFixaCentavos: 600, freteCentavos: 0, impostoPercent: 4, margemDesejadaPercent: 20 };

describe('preço sugerido', () => {
  it('resolve algebricamente: a margem real bate com a desejada', () => {
    const custo = 5000;
    const p = precoSugerido(custo, venda)!;
    // (5000 + 600) / (1 − 0,40) = 9333,33 → 9334
    expect(p).toBe(9334);
    const s = simularVenda(p, custo, venda);
    expect(s.margemPercent).toBeGreaterThanOrEqual(19.99);
    expect(s.margemPercent).toBeLessThan(20.05);
  });

  it('percentuais ≥ 100% → impossível', () => {
    expect(precoSugerido(1000, { ...venda, margemDesejadaPercent: 80 })).toBeNull();
  });

  it('simulação mostra prejuízo', () => {
    const s = simularVenda(1000, 2000, venda);
    expect(s.lucroCentavos).toBeLessThan(0);
  });
});

describe('cálculo de custos', () => {
  const peca: Peca = {
    id: 'p1',
    nome: 'Prateleira',
    chapaId: 'mdf-branco-15',
    comprimento: 600,
    largura: 250,
    quantidade: 2,
    podeGirar: true,
    bordas: { c1: 'fita-branca-22', c2: null, l1: 'fita-branca-22', l2: 'fita-branca-22' },
    furos: [{ tipo: 'cavilha_8', quantidade: 4 }],
  };
  const config: Config = {
    ...CONFIG_PADRAO,
    servico: { ...CONFIG_PADRAO.servico, corteModo: 'por_peca', cortePrecoCentavos: 100, coladeiraPrecoMetroCentavos: 0, perdaFitaPercent: 10, maoDeObraHoraCentavos: 2000, chapaCobranca: 'inteiras' },
  };

  it('soma fita, corte, furos, chapa e mão de obra para o lote', () => {
    const lote = 3;
    const plano = planejarCorte([peca], lote, CATALOGO_PADRAO.chapas, { kerf: 4, refilo: 10, tempoMs: 50 });
    const c = calcularCustos({ pecas: [peca], lote, ferragens: [{ ferragemId: 'puxador', quantidade: 1 }], extras: [{ descricao: 'Embalagem', custoCentavos: 300 }], horasMaoDeObra: 0.5, plano, catalogo: CATALOGO_PADRAO, config });

    // fita: (600 + 250 + 250) mm × 2 peças × 3 = 6,6 m; +10% = 7,26 m × R$0,60 = 435,6 → 436
    expect(c.metrosFita).toBeCloseTo(6.6, 5);
    expect(c.porGrupo['Fita de borda']).toBe(436);
    // corte: 6 peças × R$1,00
    expect(c.porGrupo['Corte']).toBe(600);
    // furos: 4 × 2 × 3 = 24 × R$0,30
    expect(c.porGrupo['Furação']).toBe(720);
    // 1 chapa inteira
    expect(c.porGrupo['Chapa']).toBe(23000);
    // puxador 3 × R$8 ; embalagem 3 × R$3
    expect(c.porGrupo['Ferragens']).toBe(2400);
    expect(c.porGrupo['Extras']).toBe(900);
    // 0,5h × 3 × R$20
    expect(c.porGrupo['Mão de obra']).toBe(3000);
    expect(c.totalLoteCentavos).toBe(436 + 600 + 720 + 23000 + 2400 + 900 + 3000);
    expect(c.unitarioCentavos).toBe(Math.round(c.totalLoteCentavos / 3));
  });

  it('modo proporcional cobra só a área usada + perda', () => {
    const cfg: Config = { ...config, servico: { ...config.servico, chapaCobranca: 'proporcional', perdaChapaPercent: 0 } };
    const plano = planejarCorte([peca], 1, CATALOGO_PADRAO.chapas, { kerf: 4, refilo: 10, tempoMs: 50 });
    const c = calcularCustos({ pecas: [peca], lote: 1, ferragens: [], extras: [], horasMaoDeObra: 0, plano, catalogo: CATALOGO_PADRAO, config: cfg });
    const esperado = Math.round(((2 * 600 * 250) / (2750 * 1850)) * 23000);
    expect(c.porGrupo['Chapa']).toBe(esperado);
  });
});
