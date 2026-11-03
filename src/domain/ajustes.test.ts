import { describe, expect, it } from 'vitest';
import { CATALOGO_PADRAO, CONFIG_PADRAO } from './defaults';
import { montarProjeto } from './composicao';
import { calcularFuracao, chaveFuro } from './usinagem';
import { padroes, templatePorId } from '../templates';
import type { Modulo, Projeto } from './types';

const ctx = { catalogo: CATALOGO_PADRAO, config: CONFIG_PADRAO };
const t = templatePorId('armario-portas');
const proj = (m: Partial<Modulo> = {}): Projeto => ({ id: 'p', nome: 'p', templateId: t.id, parametros: padroes(t), modulos: [{ id: 'm1', nome: 'x', templateId: t.id, parametros: padroes(t), posicao: [0, 0, 0], ...m }], pecas: [], ferragens: [], extras: [], horasMaoDeObra: 0, quantidadeLote: 1, atualizadoEm: 0 });

describe('furos e ferragens ajustados à mão', () => {
  const base = montarProjeto(proj(), ctx);
  const furosBase = calcularFuracao(base.pecas).get('m1:porta-1')!;
  const caneco = furosBase.find((f) => f.tipo === 'caneco')!;

  it('tirar um caneco some do desenho e do custo; furo novo aparece marcado', () => {
    const extra = { tipo: 'outro' as const, onde: 'face' as const, x: 100, y: 50, lado: 1 as const, diametro: 10, profundidade: 'passante' as const };
    const m = montarProjeto(proj({ ajustesFuros: { 'porta-1': { removidos: [chaveFuro(caneco)], extras: [extra] } } }), ctx);
    const furos = calcularFuracao(m.pecas).get('m1:porta-1')!;
    expect(furos.filter((f) => f.tipo === 'caneco')).toHaveLength(furosBase.filter((f) => f.tipo === 'caneco').length - 1);
    expect(furos.find((f) => f.tipo === 'outro')?.manual).toBe(true);
    const porta = m.pecas.find((p) => p.id === 'm1:porta-1')!;
    const original = base.pecas.find((p) => p.id === 'm1:porta-1')!;
    const q = (p: typeof porta, tipo: string) => p.furos.find((f) => f.tipo === tipo)?.quantidade ?? 0;
    expect(q(porta, 'dobradica_35')).toBe(q(original, 'dobradica_35') - 1);
    expect(q(porta, 'outro')).toBe(q(original, 'outro') + 1);
  });

  it('ferragem da peça: troca quantidade, tira e adiciona', () => {
    const m = montarProjeto(proj({ ajustesFerragens: { 'porta-1': { 'dobradica-35': 3, puxador: 0, 'suporte-parede': 2 } } }), ctx);
    const daPorta = m.ferragens.filter((f) => f.pecaId === 'm1:porta-1');
    expect(daPorta.find((f) => f.ferragemId === 'dobradica-35')?.quantidade).toBe(3);
    expect(daPorta.some((f) => f.ferragemId === 'puxador')).toBe(false);
    expect(daPorta.find((f) => f.ferragemId === 'suporte-parede')?.quantidade).toBe(2);
  });
});
