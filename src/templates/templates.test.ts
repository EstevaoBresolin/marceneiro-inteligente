import { describe, expect, it } from 'vitest';
import { CATALOGO_PADRAO, CONFIG_PADRAO } from '../domain/defaults';
import { armarioBanheiro } from './armarioBanheiro';
import { padroes, TEMPLATES } from './index';

const ctx = { catalogo: CATALOGO_PADRAO, config: CONFIG_PADRAO };
const linha = (pecas: ReturnType<typeof armarioBanheiro.gerar>['pecas'], id: string) => pecas.find((p) => p.id === id)!;

describe('armário de banheiro', () => {
  it('500 × 600 × 150, 15mm, 2 prateleiras, 1 porta com espelho colado, fundo HDF pregado', () => {
    const r = armarioBanheiro.gerar(padroes(armarioBanheiro), ctx);
    const lat = linha(r.pecas, 'lateral');
    expect([lat.comprimento, lat.largura, lat.quantidade]).toEqual([600, 147, 2]); // 150 − 3 do fundo
    const tampo = linha(r.pecas, 'tampo');
    expect([tampo.comprimento, tampo.largura]).toEqual([470, 147]); // 500 − 2×15
    expect(linha(r.pecas, 'base').comprimento).toBe(470);
    const prat = linha(r.pecas, 'prateleira');
    expect([prat.comprimento, prat.largura, prat.quantidade]).toEqual([468, 127, 2]); // folga 1mm/lado; 147 − 20 de recuo
    const fundo = linha(r.pecas, 'fundo');
    expect([fundo.comprimento, fundo.largura, fundo.chapaId]).toEqual([596, 496, 'hdf-branco-3']);
    const porta = linha(r.pecas, 'porta');
    expect([porta.comprimento, porta.largura, porta.quantidade]).toEqual([596, 496, 1]); // folga 2mm
    expect(porta.furos.find((f) => f.tipo === 'dobradica_35')?.quantidade).toBe(2);
    expect(r.ferragens.find((f) => f.ferragemId === 'dobradica-35')?.quantidade).toBe(2);
    // espelho: (496−6) × (596−6) = 0,2891 m²
    expect(r.extras[0].custoCentavos).toBe(Math.round(0.2891 * CONFIG_PADRAO.servico.espelhoM2Centavos));
  });

  it('2 portas dividem a largura com 3 folgas', () => {
    const r = armarioBanheiro.gerar({ ...padroes(armarioBanheiro), portas: '2' }, ctx);
    const porta = linha(r.pecas, 'porta');
    expect(porta.largura).toBe(247); // (500 − 6) / 2
    expect(porta.quantidade).toBe(2);
  });

  it('tampo sobre as laterais', () => {
    const r = armarioBanheiro.gerar({ ...padroes(armarioBanheiro), montagem: 'tampo_sobre' }, ctx);
    expect(linha(r.pecas, 'lateral').comprimento).toBe(570);
    expect(linha(r.pecas, 'tampo').comprimento).toBe(500);
  });

  it('nicho embaixo encurta a porta e cria divisória', () => {
    const r = armarioBanheiro.gerar({ ...padroes(armarioBanheiro), nicho: true, alturaNicho: 120 }, ctx);
    expect(linha(r.pecas, 'divisoria').comprimento).toBe(470);
    // porta de (15 + 120 + 2) até 598
    expect(linha(r.pecas, 'porta').comprimento).toBe(461);
  });

  it('porta de espelho não gera porta de MDF', () => {
    const r = armarioBanheiro.gerar({ ...padroes(armarioBanheiro), espelho: 'porta_espelho' }, ctx);
    expect(r.pecas.find((p) => p.id === 'porta')).toBeUndefined();
    expect(r.ferragens.find((f) => f.ferragemId === 'dobradica-vidro')?.quantidade).toBe(2);
  });
});

describe('todos os templates', () => {
  it('geram peças com medidas positivas', () => {
    for (const t of TEMPLATES) {
      const r = t.gerar(padroes(t), ctx);
      for (const p of r.pecas) {
        expect(p.comprimento, `${t.id}/${p.id}`).toBeGreaterThan(0);
        expect(p.largura, `${t.id}/${p.id}`).toBeGreaterThan(0);
      }
    }
  });
});
