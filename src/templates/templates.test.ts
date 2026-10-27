import { describe, expect, it } from 'vitest';
import { CATALOGO_PADRAO, CONFIG_PADRAO } from '../domain/defaults';
import { armarioBanheiro, armarioPortas } from './armarioBanheiro';
import { estante } from './caixas';
import { gaveteiro } from './gaveteiro';
import { padroes, TEMPLATES } from './index';

const ctx = { catalogo: CATALOGO_PADRAO, config: CONFIG_PADRAO };
type R = ReturnType<typeof armarioBanheiro.gerar>;
const linha = (r: R, id: string) => r.pecas.find((p) => p.id === id)!;
const dims = (r: R, id: string) => [linha(r, id).comprimento, linha(r, id).largura];

describe('armário de banheiro', () => {
  it('500 × 600 × 150, 15mm, 2 prateleiras, 1 porta com espelho colado, fundo HDF pregado', () => {
    const r = armarioBanheiro.gerar(padroes(armarioBanheiro), ctx);
    expect(dims(r, 'lateral-esq')).toEqual([600, 147]); // 150 − 3 do fundo
    expect(dims(r, 'lateral-dir')).toEqual([600, 147]);
    expect(dims(r, 'tampo')).toEqual([470, 147]); // 500 − 2×15
    expect(dims(r, 'base')).toEqual([470, 147]);
    expect(dims(r, 'prateleira-1')).toEqual([468, 127]); // folga 1mm/lado; 147 − 20 de recuo
    expect(dims(r, 'prateleira-2')).toEqual([468, 127]);
    expect(dims(r, 'fundo')).toEqual([596, 496]);
    expect(linha(r, 'fundo').chapaId).toBe('hdf-branco-3');
    expect(dims(r, 'porta-1')).toEqual([596, 496]); // folga 2mm
    expect(linha(r, 'porta-1').furos.find((f) => f.tipo === 'dobradica_35')?.quantidade).toBe(2);
    expect(r.ferragens.filter((f) => f.ferragemId === 'dobradica-35').reduce((s, f) => s + f.quantidade, 0)).toBe(2);
    // cada peça física é uma linha
    expect(r.pecas.filter((p) => !p.somente3d).every((p) => p.quantidade === 1)).toBe(true);
    // espelho: (496−6) × (596−6) = 0,2891 m², ligado à peça do espelho
    expect(r.extras[0].custoCentavos).toBe(Math.round(0.2891 * CONFIG_PADRAO.servico.espelhoM2Centavos));
    expect(linha(r, 'espelho-1').dependeDe).toBe('porta-1');
  });

  it('2 portas dividem a largura com 3 folgas', () => {
    const r = armarioBanheiro.gerar({ ...padroes(armarioBanheiro), portas: '2' }, ctx);
    expect(linha(r, 'porta-1').largura).toBe(247); // (500 − 6) / 2
    expect(linha(r, 'porta-2').largura).toBe(247);
  });

  it('tampo sobre as laterais', () => {
    const r = armarioBanheiro.gerar({ ...padroes(armarioBanheiro), montagem: 'tampo_sobre' }, ctx);
    expect(linha(r, 'lateral-esq').comprimento).toBe(570);
    expect(linha(r, 'tampo').comprimento).toBe(500);
  });

  it('nicho embaixo encurta a porta e cria divisória', () => {
    const r = armarioBanheiro.gerar({ ...padroes(armarioBanheiro), nicho: true, alturaNicho: 120 }, ctx);
    expect(linha(r, 'divisoria').comprimento).toBe(470);
    expect(linha(r, 'porta-1').comprimento).toBe(461); // de (15 + 120 + 2) até 598
  });

  it('porta de espelho não gera porta de MDF', () => {
    const r = armarioBanheiro.gerar({ ...padroes(armarioBanheiro), espelho: 'porta_espelho' }, ctx);
    expect(linha(r, 'porta-1').somente3d).toBe(true);
    expect(r.ferragens.find((f) => f.ferragemId === 'dobradica-vidro')?.quantidade).toBe(2);
  });
});

describe('armário com portas', () => {
  it('rodapé levanta a base e cria a peça do rodapé', () => {
    const r = armarioPortas.gerar({ ...padroes(armarioPortas), rodape: 100 }, ctx);
    expect(dims(r, 'rodape')).toEqual([570, 100]); // 600 − 2×15
    expect(linha(r, 'base').box3d!.pos[1]).toBe(100 + 7.5);
    expect(linha(r, 'lateral-esq').comprimento).toBe(700); // laterais vão até o chão
  });
});

describe('estante', () => {
  it('2 colunas, 3 prateleiras por coluna', () => {
    const r = estante.gerar(padroes(estante), ctx);
    // 800 − 2×18 − 18 = 746 → 373 por coluna
    expect(dims(r, 'prateleira-1-1')).toEqual([373, 297]);
    expect(r.pecas.filter((p) => p.papel === 'prateleira')).toHaveLength(6);
    expect(dims(r, 'divisoria-1')).toEqual([1164, 297]);
  });
});

describe('gaveteiro', () => {
  it('3 gavetas: frentes, caixas e corrediças', () => {
    const r = gaveteiro.gerar(padroes(gaveteiro), ctx);
    // (600 − 4×2) / 3 = 197
    expect(dims(r, 'gaveta-1-frente')).toEqual([446, 197]);
    // corrediça: profundidade útil 450 − 3 − 10 = 437 → 400
    expect(linha(r, 'gaveta-1-lat-esq').comprimento).toBe(400);
    // largura da caixa: 450 − 30 − 25 = 395
    expect(dims(r, 'gaveta-1-contrafrente')).toEqual([365, 157]);
    expect(r.ferragens.filter((f) => f.ferragemId === 'corredica-telescopica')).toHaveLength(3);
    expect(linha(r, 'gaveta-2-traseira').dependeDe).toBe('gaveta-2-frente');
  });
});

describe('todos os templates', () => {
  it('geram peças com medidas positivas e ids únicos', () => {
    for (const t of TEMPLATES) {
      const r = t.gerar(padroes(t), ctx);
      const ids = new Set(r.pecas.map((p) => p.id));
      expect(ids.size, t.id).toBe(r.pecas.length);
      for (const p of r.pecas) {
        expect(p.comprimento, `${t.id}/${p.id}`).toBeGreaterThan(0);
        expect(p.largura, `${t.id}/${p.id}`).toBeGreaterThan(0);
      }
      expect(t.validar?.(padroes(t), ctx) ?? [], t.id).toEqual([]);
    }
  });
});
