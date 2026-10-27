import { describe, expect, it } from 'vitest';
import { padroes } from '../templates';
import { nicho } from '../templates/outros';
import { armarioBanheiro } from '../templates/armarioBanheiro';
import { CATALOGO_PADRAO, CONFIG_PADRAO } from './defaults';
import { encaixar, montarProjeto, normalizarProjeto, parametrosHerdados, posicaoAoLado } from './composicao';
import type { Projeto } from './types';

const ctx = { catalogo: CATALOGO_PADRAO, config: CONFIG_PADRAO };

const projetoAntigo: Projeto = {
  id: 'p',
  nome: 'Armário',
  templateId: 'armario-banheiro',
  parametros: padroes(armarioBanheiro),
  pecas: [{ id: 'tampo', nome: 'Tampo', chapaId: 'mdf-branco-15', comprimento: 471, largura: 147, quantidade: 1, podeGirar: true, bordas: { c1: null, c2: null, l1: null, l2: null }, furos: [], editadaManualmente: true }],
  ferragens: [],
  extras: [],
  horasMaoDeObra: 1,
  quantidadeLote: 1,
  atualizadoEm: 0,
};

describe('composição por módulos', () => {
  it('projeto antigo vira um módulo e mantém a peça editada à mão', () => {
    const n = normalizarProjeto(projetoAntigo);
    expect(n.modulos).toHaveLength(1);
    const m = montarProjeto(projetoAntigo, ctx);
    expect(m.pecas.find((x) => x.id === 'm1:tampo')?.comprimento).toBe(471);
    expect(m.pecas.find((x) => x.id === 'm1:tampo')?.nome).toBe('Tampo');
  });

  it('nicho à direita do armário: herda altura/profundidade e encosta na lateral', () => {
    const base = normalizarProjeto(projetoAntigo);
    const arm = montarProjeto(base, ctx).modulos[0];
    const params = parametrosHerdados(nicho, arm, 'direita');
    expect(params.altura).toBe(600);
    expect(params.profundidade).toBe(150);
    const localNicho = montarProjeto({ ...base, modulos: [{ id: 'x', nome: 'Nicho', templateId: 'nicho', parametros: params, posicao: [0, 0, 0] }], pecas: [] }, ctx).modulos[0].limitesLocais;
    const pos = posicaoAoLado(arm, localNicho, 'direita');
    const proj: Projeto = { ...base, modulos: [...base.modulos!, { id: 'm2', nome: 'Nicho', templateId: 'nicho', parametros: { ...params, prateleiras: 1 }, posicao: pos }] };
    const m = montarProjeto(proj, ctx);
    const [a, b] = m.modulos;
    expect(b.limites.min[0]).toBeCloseTo(a.limites.max[0]); // encostados
    expect(b.limites.min[1]).toBeCloseTo(a.limites.min[1]); // mesma base
    expect(b.limites.min[2]).toBeCloseTo(a.limites.min[2]); // fundos alinhados
    // nomes ficam prefixados quando há mais de um módulo
    expect(m.pecas.some((x) => x.nome === 'Nicho: Prateleira')).toBe(true);
    expect(m.pecas.some((x) => x.id === 'm2:prateleira')).toBe(true);
    // conjunto: 500 + 400 de largura
    expect(m.limites!.max[0] - m.limites!.min[0]).toBe(900);
  });

  it('encaixe puxa o módulo para a face do vizinho', () => {
    const local = { min: [-200, 0, 0], max: [200, 600, 150] } as const;
    const vizinho = { min: [-250, 0, 0], max: [250, 600, 169] } as { min: [number, number, number]; max: [number, number, number] };
    // soltou com 25 mm de folga à direita → encosta (x = 250 + 200)
    expect(encaixar({ min: [...local.min], max: [...local.max] }, [475, 12, 0], [vizinho])).toEqual([450, 0, 0]);
    // longe de tudo → só arredonda
    expect(encaixar({ min: [...local.min], max: [...local.max] }, [1203, 801, 0], [vizinho])).toEqual([1205, 800, 0]);
  });
});
