import { TEMPLATES, templatePorId, type Contexto, type Params, type Template } from '../templates';
import type { Box3d, Extra, ItemFerragem, Modulo, Peca, Projeto } from './types';

export type Vec3 = [number, number, number];
export type Limites = { min: Vec3; max: Vec3 };

export type ModuloMontado = {
  modulo: Modulo;
  template: Template;
  /** caixa do módulo em coordenadas próprias (sem a posição) */
  limitesLocais: Limites;
  /** caixa do módulo no projeto */
  limites: Limites;
  erros: string[];
};

export type ProjetoMontado = {
  pecas: Peca[];
  ferragens: ItemFerragem[];
  extras: Extra[];
  modulos: ModuloMontado[];
  limites: Limites | null;
  erros: string[];
};

export const SEP = ':';
/** "m1:lateral#2" → "m1" */
export const moduloDaPeca = (id: string) => (id.includes(SEP) ? id.slice(0, id.indexOf(SEP)) : null);

const NOMES_CURTOS: Record<string, string> = {
  'armario-banheiro': 'Armário',
  nicho: 'Nicho',
  prateleira: 'Prateleira',
  'suporte-monitor': 'Suporte',
};
export const nomeCurto = (templateId: string) => NOMES_CURTOS[templateId] ?? templatePorId(templateId).nome;

/** Projetos antigos (um móvel só) viram um projeto com um módulo */
export function normalizarProjeto(p: Projeto): Projeto {
  if (p.templateId === 'livre' || p.modulos?.length) return p;
  const id = 'm1';
  return {
    ...p,
    modulos: [{ id, nome: nomeCurto(p.templateId), templateId: p.templateId, parametros: p.parametros, posicao: [0, 0, 0] }],
    // peças editadas à mão passam a ter o id prefixado pelo módulo
    pecas: p.pecas.filter((x) => x.editadaManualmente).map((x) => ({ ...x, id: x.id.includes(SEP) ? x.id : `${id}${SEP}${x.id}` })),
  };
}

export function transladar(b: Box3d, d: Vec3): Box3d {
  return {
    ...b,
    pos: [b.pos[0] + d[0], b.pos[1] + d[1], b.pos[2] + d[2]],
    dobradica: b.dobradica ? { ...b.dobradica, x: b.dobradica.x + d[0], z: b.dobradica.z + d[2] } : undefined,
  };
}

export function limitesDe(boxes: Box3d[]): Limites | null {
  if (!boxes.length) return null;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.pos[i] - b.size[i] / 2);
      max[i] = Math.max(max[i], b.pos[i] + b.size[i] / 2);
    }
  return { min, max };
}

const somar = (l: Limites, d: Vec3): Limites => ({
  min: [l.min[0] + d[0], l.min[1] + d[1], l.min[2] + d[2]],
  max: [l.max[0] + d[0], l.max[1] + d[1], l.max[2] + d[2]],
});

const VAZIO: Limites = { min: [0, 0, 0], max: [0, 0, 0] };

/** junta as peças geradas com as que o usuário editou à mão */
function mesclar(geradas: Peca[], salvas: Peca[]): Peca[] {
  return geradas.map((g) => {
    const s = salvas.find((x) => x.id === g.id && x.editadaManualmente);
    return s ? { ...s, box3d: g.box3d, somente3d: g.somente3d } : g;
  });
}

export function montarProjeto(p: Projeto, ctx: Contexto): ProjetoMontado {
  if (p.templateId === 'livre') return { pecas: p.pecas, ferragens: p.ferragens, extras: p.extras, modulos: [], limites: null, erros: [] };

  const norm = normalizarProjeto(p);
  const mods = norm.modulos ?? [];
  const varios = mods.length > 1;
  const pecas: Peca[] = [];
  const ferragens: ItemFerragem[] = [...p.ferragens];
  const extras: Extra[] = [...p.extras];
  const montados: ModuloMontado[] = [];
  const erros: string[] = [];

  for (const m of mods) {
    const t = templatePorId(m.templateId);
    const r = t.gerar(m.parametros, ctx);
    const errosMod = t.validar?.(m.parametros, ctx) ?? [];
    erros.push(...errosMod.map((e) => (varios ? `${m.nome}: ${e}` : e)));
    const local = limitesDe(r.pecas.flatMap((x) => (x.box3d ? [x.box3d] : []))) ?? VAZIO;
    montados.push({ modulo: m, template: t, limitesLocais: local, limites: somar(local, m.posicao), erros: errosMod });
    for (const x of r.pecas)
      pecas.push({
        ...x,
        id: `${m.id}${SEP}${x.id}`,
        nome: varios ? `${m.nome}: ${x.nome}` : x.nome,
        box3d: x.box3d ? transladar(x.box3d, m.posicao) : undefined,
      });
    ferragens.push(...r.ferragens);
    extras.push(...r.extras.map((e) => (varios ? { ...e, descricao: `${m.nome}: ${e.descricao}` } : e)));
  }

  return {
    pecas: mesclar(pecas, norm.pecas),
    ferragens,
    extras,
    modulos: montados,
    limites: limitesDe(pecas.flatMap((x) => (x.box3d ? [x.box3d] : []))),
    erros,
  };
}

// ---------------------------------------------------------------------------
// Adicionar módulo ao lado de outro
// ---------------------------------------------------------------------------
export type Lado = 'direita' | 'esquerda' | 'cima' | 'baixo';

/** parâmetros do novo módulo herdando medidas do vizinho, quando fizer sentido */
export function parametrosHerdados(novo: Template, vizinho: ModuloMontado | undefined, lado: Lado): Params {
  const p: Params = Object.fromEntries(novo.parametros.map((d) => [d.id, d.padrao]));
  if (!vizinho) return p;
  const v = vizinho.modulo.parametros;
  const herdar = lado === 'direita' || lado === 'esquerda' ? ['altura', 'profundidade'] : ['largura', 'profundidade'];
  const tem = (id: string) => novo.parametros.find((d) => d.id === id);
  for (const k of [...herdar, 'chapaId', 'fitaId']) {
    const def = tem(k);
    if (!def || v[k] === undefined) continue;
    if (def.tipo === 'numero') {
      // a profundidade do armário não inclui a porta; o nicho fica alinhado pelo fundo
      const n = Number(v[k]);
      if ((def.min === undefined || n >= def.min) && (def.max === undefined || n <= def.max)) p[k] = n;
    } else if (def.tipo === 'chapa' || def.tipo === 'fita') p[k] = v[k];
  }
  return p;
}

export function posicaoAoLado(vizinho: ModuloMontado | undefined, novoLocal: Limites, lado: Lado): Vec3 {
  if (!vizinho) return [0, 0, 0];
  const r = vizinho.limites;
  const fundo = r.min[2] - novoLocal.min[2];
  const centroX = (r.min[0] + r.max[0]) / 2 - (novoLocal.min[0] + novoLocal.max[0]) / 2;
  switch (lado) {
    case 'direita':
      return [r.max[0] - novoLocal.min[0], r.min[1] - novoLocal.min[1], fundo];
    case 'esquerda':
      return [r.min[0] - novoLocal.max[0], r.min[1] - novoLocal.min[1], fundo];
    case 'cima':
      return [centroX, r.max[1] - novoLocal.min[1], fundo];
    case 'baixo':
      return [centroX, r.min[1] - novoLocal.max[1], fundo];
  }
}

export function proximoIdModulo(mods: Modulo[]) {
  let n = mods.length + 1;
  while (mods.some((m) => m.id === `m${n}`)) n++;
  return `m${n}`;
}

export function nomeUnico(base: string, mods: Modulo[]) {
  if (!mods.some((m) => m.nome === base)) return base;
  let n = 2;
  while (mods.some((m) => m.nome === `${base} ${n}`)) n++;
  return `${base} ${n}`;
}

// ---------------------------------------------------------------------------
// Encaixe ao arrastar
// ---------------------------------------------------------------------------

/**
 * Ajusta a posição (x, y) do módulo para encostar/alinha nas faces dos outros
 * quando estiver a menos de `tol` mm. Sem vizinho perto, arredonda para 5 mm.
 */
export function encaixar(local: Limites, pos: Vec3, outros: Limites[], tol = 40): Vec3 {
  const melhor = (eixo: 0 | 1): number => {
    const a0 = local.min[eixo];
    const a1 = local.max[eixo];
    const candidatos: number[] = [];
    for (const o of outros) {
      // só encaixa no eixo se as caixas se enxergam no outro eixo (ou estão perto)
      const outro = eixo === 0 ? 1 : 0;
      const m0 = pos[outro] + local.min[outro];
      const m1 = pos[outro] + local.max[outro];
      const perto = m1 >= o.min[outro] - tol * 4 && m0 <= o.max[outro] + tol * 4;
      if (!perto) continue;
      candidatos.push(
        o.max[eixo] - a0, // encosta do outro lado
        o.min[eixo] - a1,
        o.min[eixo] - a0, // alinha as bordas
        o.max[eixo] - a1,
      );
    }
    let alvo = Math.round(pos[eixo] / 5) * 5;
    let dist = tol;
    for (const c of candidatos) {
      const d = Math.abs(c - pos[eixo]);
      if (d < dist) {
        dist = d;
        alvo = c;
      }
    }
    return alvo;
  };
  return [melhor(0), melhor(1), pos[2]];
}

export const templatesDeModulo = () => TEMPLATES.filter((t) => t.id !== 'livre');
