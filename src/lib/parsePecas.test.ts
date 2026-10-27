import { describe, expect, it } from 'vitest';
import { parsePecas } from './parsePecas';

describe('colar lista de peças', () => {
  it('entende os formatos comuns', () => {
    const { linhas, erros } = parsePecas('600x250x10\n400x120 x4\n800 × 300\n1200 300 2 Prateleira\nLateral;600;147;2');
    expect(erros).toEqual([]);
    expect(linhas).toEqual([
      { comprimento: 600, largura: 250, quantidade: 10, nome: undefined },
      { comprimento: 400, largura: 120, quantidade: 4, nome: undefined },
      { comprimento: 800, largura: 300, quantidade: 1, nome: undefined },
      { comprimento: 1200, largura: 300, quantidade: 2, nome: 'Prateleira' },
      { comprimento: 600, largura: 147, quantidade: 2, nome: 'Lateral' },
    ]);
  });

  it('aponta linhas que não entendeu', () => {
    const { erros } = parsePecas('abc');
    expect(erros).toHaveLength(1);
  });
});
