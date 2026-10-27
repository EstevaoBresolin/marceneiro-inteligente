import { describe, expect, it } from 'vitest';
import { padroes } from '../templates';
import { nicho } from '../templates/caixas';
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
    expect(m.pecas.some((x) => x.id === 'm2:prateleira-1')).toBe(true);
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

  it('remover a lateral esquerda do nicho e encostar no armário', () => {
    const base = normalizarProjeto(projetoAntigo);
    const arm = montarProjeto(base, ctx).modulos[0];
    const params = parametrosHerdados(nicho, arm, 'direita');
    const proj: Projeto = {
      ...base,
      modulos: [...base.modulos!, { id: 'm2', nome: 'Nicho', templateId: 'nicho', parametros: params, posicao: [0, 0, 0], removidas: ['lateral-esq'] }],
    };
    const m = montarProjeto(proj, ctx);
    expect(m.pecas.some((x) => x.id === 'm2:lateral-esq')).toBe(false);
    // sem a lateral, a caixa do nicho começa no tampo (15 mm para dentro)
    const nichoMod = m.modulos[1];
    expect(nichoMod.limitesLocais.min[0]).toBe(-185);
    // o fundo encolhe para acabar junto com o tampo
    expect(m.pecas.find((x) => x.id === 'm2:fundo')!.largura).toBe(400 - 15 - 2);
    expect(nichoMod.removidas).toBe(1);
    // ao encostar, o tampo do nicho toca a lateral do armário
    const pos = posicaoAoLado(arm, nichoMod.limitesLocais, 'direita');
    const m2 = montarProjeto({ ...proj, modulos: [proj.modulos![0], { ...proj.modulos![1], posicao: pos }] }, ctx);
    expect(m2.modulos[1].limites.min[0]).toBeCloseTo(m2.modulos[0].limites.max[0]);
  });

  it('remover a porta tira o espelho, as dobradiças e o custo do espelho', () => {
    const base = normalizarProjeto(projetoAntigo);
    const proj: Projeto = { ...base, modulos: [{ ...base.modulos![0], removidas: ['porta-1'] }] };
    const m = montarProjeto(proj, ctx);
    expect(m.pecas.some((x) => x.id === 'm1:porta-1' || x.id === 'm1:espelho-1')).toBe(false);
    expect(m.ferragens.some((f) => f.ferragemId === 'dobradica-35')).toBe(false);
    expect(m.extras).toHaveLength(0);
  });

  it('peça movida e peça solta', () => {
    const base = normalizarProjeto(projetoAntigo);
    const original = montarProjeto(base, ctx).pecas.find((x) => x.id === 'm1:prateleira-1')!.box3d!.pos;
    const proj: Projeto = {
      ...base,
      modulos: [
        {
          ...base.modulos![0],
          deslocamentos: { 'prateleira-1': [0, 50, 0] },
          pecasExtras: [{ id: 'solta-1', nome: 'Tábua', chapaId: 'mdf-branco-15', comprimento: 400, largura: 120, quantidade: 1, podeGirar: true, bordas: { c1: null, c2: null, l1: null, l2: null }, furos: [], livre3d: { orientacao: 'lateral', centro: [0, 300, 75] } }],
        },
      ],
    };
    const m = montarProjeto(proj, ctx);
    expect(m.pecas.find((x) => x.id === 'm1:prateleira-1')!.box3d!.pos[1]).toBe(original[1] + 50);
    const solta = m.pecas.find((x) => x.id === 'm1:solta-1')!;
    expect(solta.box3d!.size).toEqual([15, 400, 120]); // em pé de lado: espessura no x
  });

  it('encaixe funciona em outro plano (vista de cima: x e z)', () => {
    const local = { min: [-50, 0, -50], max: [50, 15, 50] } as { min: [number, number, number]; max: [number, number, number] };
    const viz = { min: [100, 0, 0], max: [300, 15, 200] } as { min: [number, number, number]; max: [number, number, number] };
    expect(encaixar(local, [43, 7, 52], [viz], 20, [0, 2])).toEqual([50, 7, 50]);
  });
});
