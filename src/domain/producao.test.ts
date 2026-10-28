import { describe, expect, it } from 'vitest';
import { padroes } from '../templates';
import { nicho } from '../templates/caixas';
import { CATALOGO_PADRAO, CONFIG_PADRAO } from './defaults';
import { pecasDaProducao } from './producao';
import { planejarCorte } from '../optimizer';
import type { Projeto } from './types';

const ctx = { catalogo: CATALOGO_PADRAO, config: CONFIG_PADRAO };
const proj = (id: string, cliente: string): Projeto => ({
  id, nome: 'Nicho', templateId: 'nicho', parametros: padroes(nicho), modulos: [{ id: 'm1', nome: 'Nicho', templateId: 'nicho', parametros: { ...padroes(nicho), largura: 900, altura: 400 }, posicao: [0, 0, 0] }],
  pecas: [], ferragens: [], extras: [], horasMaoDeObra: 1, quantidadeLote: 1, atualizadoEm: 0, cliente: { nome: cliente, telefone: '', email: '', endereco: '' },
});

describe('corte da semana', () => {
  it('junta projetos com rótulo do cliente e quantidade', () => {
    const pecas = pecasDaProducao([{ projeto: proj('a', 'Ana Souza Lima'), quantidade: 2 }, { projeto: proj('b', 'Bruno'), quantidade: 1 }], ctx);
    expect(pecas.find((p) => p.id === 'a|m1:tampo')!.nome).toBe('Ana Souza · Tampo');
    expect(pecas.find((p) => p.id === 'a|m1:tampo')!.quantidade).toBe(2);
    expect(pecas.some((p) => p.id === 'b|m1:tampo')).toBe(true);
  });

  it('juntar nunca usa mais chapas que cortar separado', () => {
    const ps = ['a', 'b', 'c', 'd'].map((x) => proj(x, x.toUpperCase() + ' cliente'));
    const opts = { kerf: 4, refilo: 10, tempoMs: 150 };
    const separado = ps.reduce((s, p) => s + planejarCorte(pecasDaProducao([{ projeto: p, quantidade: 1 }], ctx), 1, CATALOGO_PADRAO.chapas, opts).grupos.reduce((a, g) => a + g.chapas.length, 0), 0);
    const junto = planejarCorte(pecasDaProducao(ps.map((p) => ({ projeto: p, quantidade: 1 })), ctx), 1, CATALOGO_PADRAO.chapas, opts).grupos.reduce((a, g) => a + g.chapas.length, 0);
    expect(junto).toBeLessThan(separado);
  });
});
