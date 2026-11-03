import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CATALOGO_PADRAO, CONFIG_PADRAO } from '../domain/defaults';
import { novoId } from '../domain/money';
import type { Catalogo, Config, Projeto } from '../domain/types';
import { db, gravarKv, lerKv } from '../lib/db';
import { parametrosIniciais, templatePorId } from '../templates';
import { nomeCurto, normalizarProjeto } from '../domain/composicao';
import { rastrear } from '../lib/telemetria';
import { combinarProjetos, type ArquivoBackup } from '../lib/backup';
import { mudou } from '../lib/mudancas';
import type { PonteStore } from '../lib/nuvem';

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
  restaurarBackup: (a: ArquivoBackup, modo: 'mesclar' | 'substituir', comConfig: boolean) => Promise<number>;
  apagarTudo: () => Promise<void>;
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
          // ferragens novas usadas pelos modelos entram no catálogo salvo
          for (const f of CATALOGO_PADRAO.ferragens) if (!s.catalogo.ferragens.some((x) => x.id === f.id)) s.catalogo.ferragens.push(structuredClone(f));
          s.config = mesclarPadrao(config, CONFIG_PADRAO);
          s.projetos = projetos.map(normalizarProjeto);
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
      mudou({ perfil: true });
    },

    setConfig: (fn) => {
      set((s) => fn(s.config));
      void gravarKv('config', get().config);
      mudou({ perfil: true });
    },

    restaurarPadroes: () => {
      set((s) => {
        s.catalogo = structuredClone(CATALOGO_PADRAO);
        s.config = structuredClone(CONFIG_PADRAO);
      });
      void gravarKv('catalogo', get().catalogo);
      void gravarKv('config', get().config);
      mudou({ perfil: true });
    },

    salvarProjeto: (p) => {
      const atualizado = { ...p, atualizadoEm: Date.now() };
      set((s) => {
        const i = s.projetos.findIndex((x) => x.id === p.id);
        if (i >= 0) s.projetos.splice(i, 1);
        s.projetos.unshift(atualizado);
      });
      void db.projetos.put(structuredClone(atualizado)).then(() => mudou({ projeto: p.id }));
    },

    novoProjeto: (templateId) => {
      const t = templatePorId(templateId);
      const params = parametrosIniciais(t, get().config.padroes);
      const p: Projeto = {
        id: novoId(),
        nome: t.id === 'livre' ? 'Lista de peças' : t.nome,
        templateId: t.id,
        parametros: params,
        modulos: t.id === 'livre' ? undefined : [{ id: 'm1', nome: nomeCurto(t.id), templateId: t.id, parametros: params, posicao: [0, 0, 0] }],
        pecas: [],
        ferragens: [],
        extras: [],
        horasMaoDeObra: t.horasSugeridas,
        quantidadeLote: 1,
        atualizadoEm: Date.now(),
      };
      get().salvarProjeto(p);
      rastrear('projeto_criado', { modelo: t.id });
      return p;
    },

    duplicarProjeto: (id) => {
      const orig = get().projetos.find((p) => p.id === id);
      if (!orig) return;
      get().salvarProjeto({ ...structuredClone(orig), id: novoId(), nome: `${orig.nome} (cópia)`, orcamento: undefined });
      rastrear('projeto_duplicado');
    },

    removerProjeto: (id) => {
      set((s) => {
        s.projetos = s.projetos.filter((p) => p.id !== id);
      });
      void db.projetos.delete(id).then(() => mudou({ projeto: id }));
    },

    restaurarBackup: async (a, modo, comConfig) => {
      const projetos = combinarProjetos(get().projetos, a.projetos, modo);
      await db.transaction('rw', db.projetos, async () => {
        if (modo === 'substituir') await db.projetos.clear();
        await db.projetos.bulkPut(structuredClone(projetos));
      });
      set((s) => {
        s.projetos = projetos;
        if (comConfig && a.catalogo) s.catalogo = mesclarPadrao(a.catalogo, CATALOGO_PADRAO);
        if (comConfig && a.config) {
          const prox = Math.max(s.config.proximoOrcamento, a.config.proximoOrcamento ?? 1);
          s.config = { ...mesclarPadrao(a.config, CONFIG_PADRAO), proximoOrcamento: prox, onboardingConcluido: true };
        }
      });
      if (comConfig) {
        await gravarKv('catalogo', get().catalogo);
        await gravarKv('config', get().config);
        mudou({ perfil: true });
      }
      for (const p of projetos) mudou({ projeto: p.id });
      rastrear('backup_restaurado', { modo, projetos: a.projetos.length });
      return a.projetos.length;
    },

    apagarTudo: async () => {
      await db.projetos.clear();
      await db.kv.clear();
      set((s) => {
        s.projetos = [];
        s.catalogo = structuredClone(CATALOGO_PADRAO);
        s.config = structuredClone(CONFIG_PADRAO);
      });
    },
  })),
);

/** Ligação do store com a sincronização da nuvem */
export const ponteStore: PonteStore = {
  projetos: () => useApp.getState().projetos,
  catalogo: () => useApp.getState().catalogo,
  config: () => useApp.getState().config,
  aplicar: async ({ gravar, apagar, catalogo, config }) => {
    if (gravar.length) await db.projetos.bulkPut(structuredClone(gravar));
    if (apagar.length) await db.projetos.bulkDelete(apagar);
    if (catalogo) await gravarKv('catalogo', catalogo);
    if (config) await gravarKv('config', config);
    if (!gravar.length && !apagar.length && !catalogo && !config) return;
    useApp.setState((s) => {
      const fora = new Set([...apagar, ...gravar.map((p) => p.id)]);
      s.projetos = [...gravar.map(normalizarProjeto), ...s.projetos.filter((p) => !fora.has(p.id))].sort((a, b) => b.atualizadoEm - a.atualizadoEm);
      if (catalogo) {
        s.catalogo = mesclarPadrao(catalogo, CATALOGO_PADRAO);
        for (const f of CATALOGO_PADRAO.ferragens) if (!s.catalogo.ferragens.some((x) => x.id === f.id)) s.catalogo.ferragens.push(structuredClone(f));
      }
      if (config) s.config = mesclarPadrao(config, CONFIG_PADRAO);
    });
  },
  limparLocal: () => useApp.getState().apagarTudo(),
};
