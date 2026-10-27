import { describe, expect, it } from 'vitest';
import { padroes } from '../templates';
import { armarioBanheiro } from '../templates/armarioBanheiro';
import { gaveteiro } from '../templates/gaveteiro';
import { CATALOGO_PADRAO, CONFIG_PADRAO } from './defaults';
import { montarProjeto } from './composicao';
import { calcularFuracao, numerarPecas } from './usinagem';
import type { Projeto } from './types';

const ctx = { catalogo: CATALOGO_PADRAO, config: CONFIG_PADRAO };
const proj = (templateId: string, parametros: Record<string, number | string | boolean>): Projeto => ({
  id: 'p', nome: 'p', templateId, parametros, modulos: [{ id: 'm1', nome: 'x', templateId, parametros, posicao: [0, 0, 0] }], pecas: [], ferragens: [], extras: [], horasMaoDeObra: 0, quantidadeLote: 1, atualizadoEm: 0,
});
const conta = (fs: ReturnType<typeof calcularFuracao>, id: string, tipo: string) => (fs.get(id) ?? []).filter((f) => f.tipo === tipo).length;

describe('furação calculada', () => {
  const m = montarProjeto(proj('armario-banheiro', padroes(armarioBanheiro)), ctx);
  const fs = calcularFuracao(m.pecas);

  it('cavilhas: laterais recebem na face, tampo e base no topo', () => {
    expect(conta(fs, 'm1:lateral-esq', 'cavilha')).toBe(4);
    expect(conta(fs, 'm1:lateral-dir', 'cavilha')).toBe(4);
    const tampo = fs.get('m1:tampo')!.filter((f) => f.tipo === 'cavilha');
    expect(tampo).toHaveLength(4);
    expect(tampo.every((f) => f.onde === 'topo')).toBe(true);
    expect(new Set(tampo.map((f) => f.borda))).toEqual(new Set(['l1', 'l2']));
    // a 37 mm das pontas da junta (profundidade 147)
    expect(tampo.map((f) => f.y).sort((a, b) => a - b)).toEqual([37, 37, 110, 110]);
  });

  it('dobradiças: 2 canecos na porta a 22,5 mm da borda e calços na lateral esquerda', () => {
    const can = fs.get('m1:porta-1')!.filter((f) => f.tipo === 'caneco');
    expect(can).toHaveLength(2);
    expect(can.map((f) => f.x)).toEqual([100, 496]);
    expect(can.every((f) => f.y === 22.5 && f.diametro === 35)).toBe(true);
    expect(conta(fs, 'm1:lateral-esq', 'calco')).toBe(4);
    expect(conta(fs, 'm1:lateral-dir', 'calco')).toBe(0);
  });

  it('pinos: 2 prateleiras soltas × 2 pinos em cada lateral', () => {
    expect(conta(fs, 'm1:lateral-esq', 'pino')).toBe(4);
    expect(conta(fs, 'm1:lateral-dir', 'pino')).toBe(4);
  });

  it('gaveteiro: puxador no centro da frente, caixa da gaveta com cavilhas', () => {
    const g = montarProjeto(proj('gaveteiro', padroes(gaveteiro)), ctx);
    const f = calcularFuracao(g.pecas);
    const pux = f.get('m1:gaveta-1-frente')!.filter((x) => x.tipo === 'puxador');
    expect(pux).toHaveLength(1);
    expect(pux[0].x).toBe(223);
    expect(conta(f, 'm1:gaveta-1-lat-esq', 'cavilha')).toBeGreaterThan(0);
  });

  it('numeração P1… só das peças que vão para o corte', () => {
    const n = numerarPecas(m.pecas);
    expect(n.get('m1:lateral-esq')).toBe('P1');
    expect(n.has('m1:espelho-1')).toBe(false);
  });
});
