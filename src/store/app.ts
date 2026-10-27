import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CATALOGO_PADRAO, CONFIG_PADRAO } from '../domain/defaults';
import { novoId } from '../domain/money';
import type { Catalogo, Config, Projeto } from '../domain/types';
import { db, gravarKv, lerKv } from '../lib/db';
import { padroes, templatePorId } from '../templates';

type AppState = {
  carregado: boolean;
  catalogo: Catalogo;
  config: Config;
  projetos: Projeto[];
  carregar: () => Promise<void>;
  setCatalogo: (fn: (c: Catalogo) => void) => void;
  setConfig: (fn: (c: Config) => void) => void;
  restaurarPadroes: () => void;
  salvarProjeto: (p: Projeto) => void;
  novoProjeto: (templateId: string) => Projeto;
  duplicarProjeto: (id: string) => void;
  removerProjeto: (id: string) => void;
};

function mesclarPadrao<T extends object>(salvo: T | undefined, padrao: T): T {
  if (!salvo) return structuredClone(padrao);
  // garante que campos novos (de versões futuras) existam
  const out = structuredClone(padrao) as Record<string, unknown>;
  for (const [k, v] of Object.entries(salvo)) {
    const p = (padrao as Record<string, unknown>)[k];
    out[k] = v && p && typeof v === 'object' && !Array.isArray(v) ? mesclarPadrao(v as object, p as object) : v;
  }
  return out as T;
}

export const useApp = create<AppState>()(
  immer((set, get) => ({
    carregado: false,
    catalogo: structuredClone(CATALOGO_PADRAO),
    config: structuredClone(CONFIG_PADRAO),
    projetos: [],

    carregar: async () => {
      try {
        const [catalogo, config, projetos] = await Promise.all([
          lerKv<Catalogo>('catalogo'),
          lerKv<Config>('config'),
          db.projetos.orderBy('atualizadoEm').reverse().toArray(),
        ]);
        set((s) => {
          s.catalogo = mesclarPadrao(catalogo, CATALOGO_PADRAO);
          s.config = mesclarPadrao(config, CONFIG_PADRAO);
          s.projetos = projetos;
          s.carregado = true;
        });
      } catch {
        set((s) => {
          s.carregado = true;
        });
      }
    },

    setCatalogo: (fn) => {
      set((s) => fn(s.catalogo));
      void gravarKv('catalogo', get().catalogo);
    },

    setConfig: (fn) => {
      set((s) => fn(s.config));
      void gravarKv('config', get().config);
    },

    restaurarPadroes: () => {
      set((s) => {
        s.catalogo = structuredClone(CATALOGO_PADRAO);
        s.config = structuredClone(CONFIG_PADRAO);
      });
      void gravarKv('catalogo', get().catalogo);
      void gravarKv('config', get().config);
    },

    salvarProjeto: (p) => {
      const atualizado = { ...p, atualizadoEm: Date.now() };
      set((s) => {
        const i = s.projetos.findIndex((x) => x.id === p.id);
        if (i >= 0) s.projetos.splice(i, 1);
        s.projetos.unshift(atualizado);
      });
      void db.projetos.put(structuredClone(atualizado));
    },

    novoProjeto: (templateId) => {
      const t = templatePorId(templateId);
      const params = padroes(t);
      const { catalogo, config } = get();
      const gerado = t.gerar(params, { catalogo, config });
      const p: Projeto = {
        id: novoId(),
        nome: t.id === 'livre' ? 'Lista de peças' : t.nome,
        templateId: t.id,
        parametros: params,
        pecas: gerado.pecas,
        ferragens: [],
        extras: [],
        horasMaoDeObra: t.horasSugeridas,
        quantidadeLote: 1,
        atualizadoEm: Date.now(),
      };
      get().salvarProjeto(p);
      return p;
    },

    duplicarProjeto: (id) => {
      const orig = get().projetos.find((p) => p.id === id);
      if (!orig) return;
      get().salvarProjeto({ ...structuredClone(orig), id: novoId(), nome: `${orig.nome} (cópia)` });
    },

    removerProjeto: (id) => {
      set((s) => {
        s.projetos = s.projetos.filter((p) => p.id !== id);
      });
      void db.projetos.delete(id);
    },
  })),
);
