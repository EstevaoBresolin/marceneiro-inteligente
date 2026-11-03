import { describe, expect, it } from 'vitest';
import { diasRestantes, testeAcabou, textoDias } from './conta';

const D = 86_400_000;
const agora = Date.parse('2026-11-03T12:00:00Z');
const c = (ms: number, plano: 'teste' | 'pago' | 'cortesia' = 'teste') => ({ user_id: 'x', email: null, marcenaria: null, cnpj: null, criado_em: '', teste_ate: new Date(agora + ms).toISOString(), plano });

describe('teste grátis', () => {
  it('conta nova mostra 45 dias; último dia; acabou', () => {
    expect(diasRestantes(c(45 * D), agora)).toBe(45);
    expect(textoDias(diasRestantes(c(3 * 3600_000), agora))).toBe('último dia');
    expect(diasRestantes(c(-1000), agora)).toBeLessThanOrEqual(0);
  });
  it('só bloqueia plano de teste vencido', () => {
    expect(testeAcabou(c(-D))).toBe(true);
    expect(testeAcabou(c(-D, 'pago'))).toBe(false);
    expect(testeAcabou(c(D))).toBe(false);
  });
});
