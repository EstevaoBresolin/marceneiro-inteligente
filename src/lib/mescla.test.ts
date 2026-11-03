import { describe, expect, it } from 'vitest';
import type { Projeto } from '../domain/types';
import { mesclar } from './mescla';

const p = (id: string, t: number) => ({ id, nome: id, atualizadoEm: t }) as unknown as Projeto;
const base = { pendentes: { projetos: [], perfil: false }, perfil: { catalogo: null, config: null, atualizado_em: 5 }, perfilEm: 5 };

describe('mesclar nuvem × computador', () => {
  it('primeiro login: tudo que é local sobe; nada a baixar', () => {
    const r = mesclar({ ...base, remotos: [], locais: [p('a', 1), p('b', 2)], perfil: null, perfilEm: 0 });
    expect([...r.subir].sort()).toEqual(['a', 'b']);
    expect(r.subirPerfil).toBe(true);
    expect(r.gravar).toEqual([]);
  });

  it('computador novo: baixa tudo da nuvem e o perfil', () => {
    const r = mesclar({ ...base, remotos: [{ id: 'a', dados: p('a', 9), apagado: false, atualizado_em: 9 }], locais: [], perfil: { catalogo: null, config: { x: 1 } as never, atualizado_em: 9 }, perfilEm: 0 });
    expect(r.gravar.map((x) => x.id)).toEqual(['a']);
    expect(r.config).toEqual({ x: 1 });
    expect(r.subir.size).toBe(0);
  });

  it('vale o mais novo dos dois lados', () => {
    const r = mesclar({
      ...base,
      remotos: [
        { id: 'velho-la', dados: p('velho-la', 1), apagado: false, atualizado_em: 1 },
        { id: 'novo-la', dados: p('novo-la', 9), apagado: false, atualizado_em: 9 },
      ],
      locais: [p('velho-la', 5), p('novo-la', 5)],
    });
    expect(r.gravar.map((x) => x.id)).toEqual(['novo-la']);
    expect([...r.subir]).toEqual(['velho-la']);
  });

  it('apagado em outro computador some daqui, a não ser que tenha mudado aqui depois', () => {
    const r = mesclar({
      ...base,
      remotos: [
        { id: 'a', dados: null, apagado: true, atualizado_em: 9 },
        { id: 'b', dados: null, apagado: true, atualizado_em: 3 },
      ],
      locais: [p('a', 5), p('b', 7)],
    });
    expect(r.apagar).toEqual(['a']);
    expect([...r.subir]).toEqual(['b']);
  });

  it('mudança ainda na fila não é sobrescrita', () => {
    const r = mesclar({ ...base, remotos: [{ id: 'a', dados: p('a', 99), apagado: false, atualizado_em: 99 }], locais: [p('a', 5)], pendentes: { projetos: ['a'], perfil: true }, perfil: { catalogo: null, config: null, atualizado_em: 99 } });
    expect(r.gravar).toEqual([]);
    expect(r.config).toBeUndefined();
  });
});
