import { describe, expect, it } from 'vitest';
import { CATALOGO_PADRAO, CONFIG_PADRAO } from '../domain/defaults';
import type { Projeto } from '../domain/types';
import { combinarProjetos, lerBackup, montarBackup } from './backup';

const proj = (id: string, em: number, nome = id): Projeto => ({ id, nome, templateId: 'livre', parametros: {}, pecas: [], ferragens: [], extras: [], horasMaoDeObra: 0, quantidadeLote: 1, atualizadoEm: em });

describe('backup', () => {
  it('ida e volta mantém projetos, catálogo e configurações', () => {
    const txt = JSON.stringify(montarBackup([proj('a', 1), proj('b', 2)], CATALOGO_PADRAO, CONFIG_PADRAO));
    const r = lerBackup(txt);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.arquivo.projetos.map((p) => p.id)).toEqual(['a', 'b']);
    expect(r.arquivo.catalogo?.chapas.length).toBe(CATALOGO_PADRAO.chapas.length);
    expect(r.arquivo.config?.venda.margemDesejadaPercent).toBe(CONFIG_PADRAO.venda.margemDesejadaPercent);
  });

  it('recusa arquivos que não são backup', () => {
    expect(lerBackup('oi').ok).toBe(false);
    expect(lerBackup('{"formato":"outro","projetos":[]}').ok).toBe(false);
    expect(lerBackup('{"formato":"marceneiro-inteligente","versao":99,"projetos":[]}').ok).toBe(false);
    // ignora itens quebrados dentro da lista
    const r = lerBackup(JSON.stringify({ formato: 'marceneiro-inteligente', versao: 1, projetos: [proj('a', 1), { lixo: true }, null] }));
    expect(r.ok && r.arquivo.projetos.length).toBe(1);
  });

  it('mesclar: o mais recente vence; substituir: só o backup', () => {
    const atuais = [proj('a', 5, 'A novo'), proj('b', 1)];
    const doBackup = [proj('a', 3, 'A velho'), proj('c', 2)];
    const m = combinarProjetos(atuais, doBackup, 'mesclar');
    expect(m.map((p) => p.id).sort()).toEqual(['a', 'b', 'c']);
    expect(m.find((p) => p.id === 'a')!.nome).toBe('A novo');
    expect(combinarProjetos(atuais, doBackup, 'substituir').map((p) => p.id)).toEqual(['a', 'c']);
  });
});
