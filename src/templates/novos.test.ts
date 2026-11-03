import { describe, expect, it } from 'vitest';
import { CATALOGO_PADRAO, CONFIG_PADRAO } from '../domain/defaults';
import { detectarConflitos, montarProjeto } from '../domain/composicao';
import type { Projeto } from '../domain/types';
import { padroes, templatePorId } from './index';

const ctx = { catalogo: CATALOGO_PADRAO, config: CONFIG_PADRAO };
function montar(id: string, extra: Record<string, number | string | boolean> = {}) {
  const t = templatePorId(id);
  const parametros = { ...padroes(t), ...extra };
  const p: Projeto = { id: 'p', nome: 'p', templateId: id, parametros, modulos: [{ id: 'm1', nome: 'x', templateId: id, parametros, posicao: [0, 0, 0] }], pecas: [], ferragens: [], extras: [], horasMaoDeObra: 0, quantidadeLote: 1, atualizadoEm: 0 };
  return { m: montarProjeto(p, ctx), erros: t.validar?.(parametros, ctx) ?? [] };
}

describe('roupeiro', () => {
  it('portas de correr: 2 portas sobrepostas em trilhos diferentes, trilho e roldanas', () => {
    const { m, erros } = montar('roupeiro');
    expect(erros).toEqual([]);
    const portas = m.pecas.filter((p) => p.id.startsWith('m1:porta-'));
    expect(portas).toHaveLength(2);
    expect(portas[0].box3d!.pos[2]).not.toBe(portas[1].box3d!.pos[2]);
    expect(portas[1].box3d!.correr).toBeLessThan(0);
    // as duas juntas cobrem a largura com a sobreposição
    expect(portas[0].largura * 2 - 40).toBeGreaterThanOrEqual(1800 - 1);
    expect(m.ferragens.find((f) => f.ferragemId === 'trilho-correr')?.quantidade).toBeCloseTo(3.6);
    expect(m.ferragens.filter((f) => f.ferragemId === 'kit-porta-correr')).toHaveLength(2);
  });

  it('cabideiro na primeira coluna, 3 gavetas internas na última, maleiro em cima', () => {
    const { m } = montar('roupeiro');
    expect(m.pecas.some((p) => p.id === 'm1:cabideiro-1' && p.somente3d)).toBe(true);
    expect(m.pecas.filter((p) => /gaveta-\d-frente$/.test(p.id))).toHaveLength(3);
    expect(m.pecas.some((p) => p.id === 'm1:maleiro')).toBe(true);
    expect(m.ferragens.filter((f) => f.ferragemId === 'corredica-telescopica')).toHaveLength(3);
  });

  it('nenhuma peça batendo em outra (correr e abrir)', () => {
    for (const portas of ['correr', 'abrir']) {
      const { m } = montar('roupeiro', { portas, nPortas: portas === 'abrir' ? 4 : 3 });
      expect(detectarConflitos(m.pecas).map((c) => c.texto)).toEqual([]);
    }
  });
});

describe('cozinha', () => {
  it('balcão de pia: sem tampo, com 2 travessas e sem fundo', () => {
    const { m } = montar('balcao-pia');
    const ids = m.pecas.map((p) => p.id.replace('m1:', ''));
    expect(ids).not.toContain('tampo');
    expect(ids).toContain('travessa-frente');
    expect(ids).toContain('travessa-tras');
    expect(ids).not.toContain('fundo');
    expect(detectarConflitos(m.pecas)).toEqual([]);
  });

  it('canto cego: painel fixo do lado cego e porta no resto', () => {
    const { m } = montar('canto-cego');
    const cego = m.pecas.find((p) => p.id === 'm1:painel-cego')!;
    expect(cego.box3d!.pos[0]).toBeLessThan(0);
    const portas = m.pecas.filter((p) => p.papel === 'porta');
    expect(portas).toHaveLength(1);
    expect(portas[0].box3d!.pos[0]).toBeGreaterThan(0);
    expect(detectarConflitos(m.pecas)).toEqual([]);
  });

  it('torre de forno: vão do forno com a altura pedida', () => {
    const { m, erros } = montar('torre-forno');
    expect(erros).toEqual([]);
    const base = m.pecas.find((p) => p.id === 'm1:base-forno')!.box3d!;
    const teto = m.pecas.find((p) => p.id === 'm1:teto-forno')!.box3d!;
    const vao = teto.pos[1] - teto.size[1] / 2 - (base.pos[1] + base.size[1] / 2);
    expect(vao).toBeCloseTo(595);
    expect(m.pecas.filter((p) => /gaveta-\d-frente$/.test(p.id))).toHaveLength(2);
    expect(detectarConflitos(m.pecas)).toEqual([]);
  });
});
