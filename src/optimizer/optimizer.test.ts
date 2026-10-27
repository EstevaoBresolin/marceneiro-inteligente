import { describe, expect, it } from 'vitest';
import { otimizar } from './search';
import { guilhotinavel, validarResultado } from './validate';
import type { ChapaCorte, PecaCorte } from './types';

const CHAPA: ChapaCorte = { id: 'c', nome: 'MDF 15', largura: 2750, altura: 1850, temVeio: false };

const repetir = (n: number, w: number, h: number, podeGirar = true, rotulo = `${w}x${h}`): PecaCorte[] =>
  Array.from({ length: n }, () => ({ pecaId: rotulo, rotulo, w, h, podeGirar }));

function contar(r: ReturnType<typeof otimizar>) {
  const m = new Map<string, number>();
  for (const c of r.chapas) for (const p of c.pecas) m.set(p.rotulo, (m.get(p.rotulo) ?? 0) + 1);
  return m;
}

describe('otimizador de corte guilhotina', () => {
  it('caso de referência: 900×450 cabe 12 por chapa 2750×1850 (kerf 4, refilo 10)', () => {
    // Área útil 2730×1830. No eixo X: (2730+4)/(900+4) = 3,02 → 3; no Y: (1830+4)/(450+4) = 4,04 → 4 → 12.
    // Limite por área: (2734×1834)/(904×454) = 12,2 → no máximo 12 por chapa.
    const r24 = otimizar({ pecas: repetir(24, 900, 450), chapa: CHAPA, kerf: 4, refilo: 10, tempoMs: 300 });
    expect(r24.chapas.length).toBe(2);
    expect(r24.chapas.every((c) => c.pecas.length === 12)).toBe(true);

    const r20 = otimizar({ pecas: repetir(20, 900, 450), chapa: CHAPA, kerf: 4, refilo: 10, tempoMs: 300 });
    expect(r20.chapas.length).toBe(2);

    const r25 = otimizar({ pecas: repetir(25, 900, 450), chapa: CHAPA, kerf: 4, refilo: 10, tempoMs: 300 });
    expect(r25.chapas.length).toBe(3);
  });

  it('todas as peças aparecem exatamente uma vez', () => {
    const pecas = [...repetir(10, 600, 250, true, 'A'), ...repetir(4, 400, 120, true, 'B'), ...repetir(3, 1200, 300, true, 'C')];
    const r = otimizar({ pecas, chapa: CHAPA, kerf: 4, refilo: 10, tempoMs: 200 });
    const m = contar(r);
    expect(m.get('A')).toBe(10);
    expect(m.get('B')).toBe(4);
    expect(m.get('C')).toBe(3);
    expect(r.totalPecas).toBe(17);
    expect(r.naoCabem).toHaveLength(0);
  });

  it('sem sobreposição, dentro da área útil e guilhotinável (aleatório)', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let caso = 0; caso < 25; caso++) {
      const pecas: PecaCorte[] = [];
      const n = 5 + Math.floor(rnd() * 40);
      for (let i = 0; i < n; i++)
        pecas.push({ pecaId: `p${i}`, rotulo: `p${i}`, w: 80 + Math.floor(rnd() * 1400), h: 60 + Math.floor(rnd() * 800), podeGirar: rnd() > 0.3 });
      const kerf = [0, 3, 4][caso % 3];
      const refilo = [0, 10][caso % 2];
      const r = otimizar({ pecas, chapa: CHAPA, kerf, refilo, tempoMs: 60, seed: caso });
      expect(validarResultado(r)).toEqual([]);
      expect(r.totalPecas).toBe(n);
    }
  });

  it('peças que não podem girar nunca aparecem rotacionadas', () => {
    const pecas = [...repetir(8, 1700, 300, false, 'fixa'), ...repetir(8, 500, 200, true, 'livre')];
    const r = otimizar({ pecas, chapa: CHAPA, kerf: 4, refilo: 10, tempoMs: 200 });
    for (const c of r.chapas) for (const p of c.pecas) if (p.rotulo === 'fixa') expect(p.rotacionada).toBe(false);
  });

  it('chapa com veio: nada gira', () => {
    const r = otimizar({ pecas: repetir(10, 300, 800), chapa: { ...CHAPA, temVeio: true }, kerf: 4, refilo: 10, tempoMs: 100 });
    for (const c of r.chapas) for (const p of c.pecas) expect(p.rotacionada).toBe(false);
  });

  it('peça maior que a chapa vai para "não cabem" sem travar', () => {
    const r = otimizar({ pecas: [...repetir(1, 3000, 500, true, 'grande'), ...repetir(2, 500, 500)], chapa: CHAPA, kerf: 4, refilo: 10, tempoMs: 50 });
    expect(r.naoCabem.map((p) => p.rotulo)).toEqual(['grande']);
    expect(r.totalPecas).toBe(2);
  });

  it('peça que só cabe girada é girada', () => {
    const r = otimizar({ pecas: repetir(1, 1800, 2700), chapa: CHAPA, kerf: 4, refilo: 10, tempoMs: 50 });
    expect(r.chapas[0].pecas[0].rotacionada).toBe(true);
  });

  it('lista vazia não quebra', () => {
    const r = otimizar({ pecas: [], chapa: CHAPA, kerf: 4, refilo: 10, tempoMs: 10 });
    expect(r.chapas).toHaveLength(0);
  });

  it('sobras e metros de corte são coerentes', () => {
    const r = otimizar({ pecas: repetir(4, 600, 250), chapa: CHAPA, kerf: 4, refilo: 10, tempoMs: 100 });
    expect(r.chapas).toHaveLength(1);
    expect(r.metrosCorte).toBeGreaterThan(0);
    expect(r.maiorSobra).not.toBeNull();
    // a maior sobra deve ser grande (sobra concentrada): mais da metade da chapa
    expect(r.maiorSobra!.w * r.maiorSobra!.h).toBeGreaterThan((2730 * 1830) / 2);
  });

  it('detector de guilhotina rejeita o "catavento"', () => {
    // 4 peças em catavento ao redor de um quadrado central: não há corte de ponta a ponta
    const pecas = [
      { x: 0, y: 0, w: 200, h: 100 },
      { x: 200, y: 0, w: 100, h: 200 },
      { x: 100, y: 200, w: 200, h: 100 },
      { x: 0, y: 100, w: 100, h: 200 },
    ].map((p, i) => ({ ...p, pecaId: `${i}`, rotulo: `${i}`, rotacionada: false }));
    expect(guilhotinavel({ pecas })).toBe(false);
  });
});
