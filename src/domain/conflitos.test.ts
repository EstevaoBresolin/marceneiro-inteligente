import { describe, expect, it } from 'vitest';
import { padroes, TEMPLATES } from '../templates';
import { armarioBanheiro } from '../templates/armarioBanheiro';
import { nicho } from '../templates/caixas';
import { CATALOGO_PADRAO, CONFIG_PADRAO } from './defaults';
import { compartilharLaterais, detectarConflitos, eixosDoModulo, montarProjeto } from './composicao';
import type { Modulo, Projeto } from './types';

const ctx = { catalogo: CATALOGO_PADRAO, config: CONFIG_PADRAO };
const projeto = (modulos: Modulo[]): Projeto => ({ id: 'p', nome: 'p', templateId: 'armario-banheiro', parametros: {}, modulos, pecas: [], ferragens: [], extras: [], horasMaoDeObra: 0, quantidadeLote: 1, atualizadoEm: 0 });
const arm: Modulo = { id: 'm1', nome: 'Armário', templateId: 'armario-banheiro', parametros: padroes(armarioBanheiro), posicao: [0, 0, 0] };
const nichoAo = (x: number, extra: Record<string, number | boolean | string> = {}): Modulo => ({ id: 'm2', nome: 'Nicho', templateId: 'nicho', parametros: { ...padroes(nicho), altura: 600, profundidade: 150, ...extra }, posicao: [x, 0, 0] });

describe('peças batendo', () => {
  it('nenhum modelo bate em si mesmo', () => {
    for (const t of TEMPLATES.filter((x) => x.id !== 'livre')) {
      const m = montarProjeto(projeto([{ id: 'm1', nome: t.nome, templateId: t.id, parametros: padroes(t), posicao: [0, 0, 0] }]), ctx);
      expect(detectarConflitos(m.pecas), t.id).toEqual([]);
    }
  });

  it('módulo enfiado no outro gera aviso', () => {
    const m = montarProjeto(projeto([arm, nichoAo(400)]), ctx);
    const c = detectarConflitos(m.pecas);
    expect(c.length).toBeGreaterThan(0);
    expect(c[0].tipo).toBe('sobreposicao');
  });

  it('porta não abre quando o vizinho do lado da dobradiça é mais fundo', () => {
    // nicho de 300 de profundidade à esquerda do armário (dobradiça da porta fica à esquerda)
    const m = montarProjeto(projeto([arm, { ...nichoAo(-450, { profundidade: 300 }) }]), ctx);
    const c = detectarConflitos(m.pecas);
    expect(c.some((x) => x.tipo === 'porta' && x.a === 'm1:porta-1')).toBe(true);
    // do lado direito (sem dobradiça) não tem problema
    const m2 = montarProjeto(projeto([arm, nichoAo(450, { profundidade: 300 })]), ctx);
    expect(detectarConflitos(m2.pecas).some((x) => x.tipo === 'porta')).toBe(false);
  });
});

describe('lateral compartilhada automática', () => {
  it('nicho encostado à direita cede a lateral e desliza 15 mm', () => {
    const p = compartilharLaterais(projeto([arm, nichoAo(450)]), ctx);
    const n = p.modulos!.find((m) => m.id === 'm2')!;
    expect(n.removidas).toContain('lateral-esq');
    expect(n.posicao[0]).toBe(435);
    const m = montarProjeto(p, ctx);
    expect(m.limites!.max[0] - m.limites!.min[0]).toBe(885);
    expect(detectarConflitos(m.pecas)).toEqual([]);
  });

  it('módulo mais alto não cede: quem cabe na altura do outro é que cede', () => {
    const alto: Modulo = { ...nichoAo(450, { altura: 900 }) };
    const p = compartilharLaterais(projeto([arm, alto]), ctx);
    expect(p.modulos!.find((m) => m.id === 'm1')!.removidas).toContain('lateral-dir');
    expect(p.modulos!.find((m) => m.id === 'm2')!.removidas ?? []).not.toContain('lateral-esq');
  });

  it('separou: a lateral volta', () => {
    const p = compartilharLaterais(projeto([arm, nichoAo(450)]), ctx);
    const longe = { ...p, modulos: p.modulos!.map((m) => (m.id === 'm2' ? { ...m, posicao: [900, 0, 0] as [number, number, number] } : m)) };
    const q = compartilharLaterais(longe, ctx);
    const n = q.modulos!.find((m) => m.id === 'm2')!;
    expect(n.removidas ?? []).not.toContain('lateral-esq');
    expect(n.posicao[0]).toBe(915);
  });

  it('desligado: não mexe', () => {
    const p = compartilharLaterais({ ...projeto([arm, nichoAo(450)]), compartilharLaterais: false }, ctx);
    expect(p.modulos![1].removidas).toBeUndefined();
  });

  it('alças: armário controla largura, altura e profundidade', () => {
    expect(eixosDoModulo(armarioBanheiro, padroes(armarioBanheiro)).map((e) => e.param)).toEqual(['largura', 'altura', 'profundidade']);
  });
});
