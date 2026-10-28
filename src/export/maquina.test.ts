import { describe, expect, it } from 'vitest';
import { CATALOGO_PADRAO, CONFIG_PADRAO } from '../domain/defaults';
import { montarProjeto } from '../domain/composicao';
import { calcularFuracao } from '../domain/usinagem';
import { padroes } from '../templates';
import { armarioBanheiro } from '../templates/armarioBanheiro';
import type { Projeto } from '../domain/types';
import { CSV_PADRAO, MODELOS_CSV, camadaFuro, gerarCsv, gerarDxf, zipDxf } from './maquina';

const ctx = { catalogo: CATALOGO_PADRAO, config: CONFIG_PADRAO };
const proj: Projeto = { id: 'p', nome: 'p', templateId: 'armario-banheiro', parametros: padroes(armarioBanheiro), modulos: [{ id: 'm1', nome: 'x', templateId: 'armario-banheiro', parametros: padroes(armarioBanheiro), posicao: [0, 0, 0] }], pecas: [], ferragens: [], extras: [], horasMaoDeObra: 0, quantidadeLote: 1, atualizadoEm: 0 };
const m = montarProjeto(proj, ctx);

describe('CSV para máquina', () => {
  it('completo: ; e vírgula decimal, uma linha por peça + cabeçalho', () => {
    const csv = gerarCsv(m.pecas, CATALOGO_PADRAO, CSV_PADRAO, 2);
    const linhas = csv.replace('﻿', '').split('\r\n');
    expect(linhas[0]).toBe('Nº;Peça;Comprimento;Largura;Quantidade;Material;Espessura;Respeita veio;Fita C1;Fita C2;Fita L1;Fita L2');
    expect(linhas.length).toBe(1 + m.pecas.filter((p) => !p.somente3d).length);
    expect(linhas[1]).toContain(';600;147;2;MDF Branco TX 15mm;15;não;Fita PVC Branca 22mm;;');
  });

  it('modelo em inglês: vírgula, 1/0 e sem acento no cabeçalho', () => {
    const cfg = { modelo: 'ingles', ...MODELOS_CSV[1].cfg };
    const linhas = gerarCsv(m.pecas, CATALOGO_PADRAO, cfg).replace('﻿', '').split('\r\n');
    expect(linhas[0]).toBe('Length,Width,Qty,Material,Label,Grain,Band L1,Band W1,Band L2,Band W2');
    expect(linhas[1]).toBe('600,147,1,MDF Branco TX 15mm,Lateral esquerda,0,1,1,0,1');
  });
});

describe('DXF', () => {
  const furos = calcularFuracao(m.pecas);
  it('porta: contorno e 2 canecos na camada certa', () => {
    const porta = m.pecas.find((p) => p.id === 'm1:porta-1')!;
    const dxf = gerarDxf(porta, furos.get(porta.id)!, 'P8', 15);
    expect(dxf.startsWith('0\r\nSECTION')).toBe(true);
    expect(dxf.trim().endsWith('EOF')).toBe(true);
    expect(dxf.match(/\r\nLINE\r\n8\r\nCONTORNO/g)?.length).toBe(4);
    const camada = camadaFuro(35, 12.5, false);
    expect(camada).toBe('FURO_D35_P12_5');
    expect(dxf.match(new RegExp(`CIRCLE\\r\\n8\\r\\n${camada}`, 'g'))?.length).toBe(2);
  });

  it('zip com um DXF por peça e o leia-me', async () => {
    const { unzipSync } = await import('fflate');
    const itens = m.pecas.filter((p) => !p.somente3d).map((p, i) => ({ peca: p, numero: `P${i + 1}`, quantidade: 1, furos: furos.get(p.id) ?? [] }));
    const z = unzipSync(await zipDxf(itens, CATALOGO_PADRAO));
    const nomes = Object.keys(z);
    expect(nomes).toContain('LEIA-ME.txt');
    expect(nomes.filter((n) => n.endsWith('.dxf')).length).toBe(itens.length);
  });
});
