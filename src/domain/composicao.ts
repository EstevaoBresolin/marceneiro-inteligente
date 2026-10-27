import { TEMPLATES, templatePorId, type Contexto, type Params, type Template } from '../templates';
import { boxDaTabua } from '../templates/outros';
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
  /** quantas peças do modelo o usuário tirou */
  removidas: number;
  /** caixa só do corpo (sem portas, frentes e espelhos), no projeto */
  corpo: Limites;
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
    const r = t.gerar(m.parametros, { ...ctx, removidas: new Set(m.removidas ?? []) });
    const errosMod = t.validar?.(m.parametros, ctx) ?? [];
    erros.push(...errosMod.map((e) => (varios ? `${m.nome}: ${e}` : e)));

    // peças soltas do usuário: o 3D vem da orientação + centro
    const soltas = (m.pecasExtras ?? []).map((x) => {
      const chapa = ctx.catalogo.chapas.find((c) => c.id === x.chapaId);
      const l3 = x.livre3d ?? { orientacao: 'horizontal' as const, centro: [0, 0, 0] as Vec3 };
      return { ...x, box3d: boxDaTabua(x.comprimento, x.largura, chapa?.espessura ?? 15, l3.orientacao, l3.centro) };
    });

    // remoções (e o que depende delas, ex.: espelho da porta)
    const removidas = new Set(m.removidas ?? []);
    for (const x of r.pecas) if (x.dependeDe && removidas.has(x.dependeDe)) removidas.add(x.id);
    const desl = m.deslocamentos ?? {};

    const locais = [...r.pecas.filter((x) => !removidas.has(x.id)), ...soltas].map((x) => {
      const d = desl[x.id];
      return d && x.box3d ? { ...x, box3d: transladar(x.box3d, d) } : x;
    });

    const local = limitesDe(locais.flatMap((x) => (x.box3d ? [x.box3d] : []))) ?? VAZIO;
    const corpoLocal = limitesDe(locais.filter((x) => x.papel !== 'porta' && x.papel !== 'espelho').flatMap((x) => (x.box3d ? [x.box3d] : []))) ?? local;
    montados.push({ modulo: m, template: t, limitesLocais: local, limites: somar(local, m.posicao), corpo: somar(corpoLocal, m.posicao), erros: errosMod, removidas: removidas.size });
    for (const x of locais)
      pecas.push({
        ...x,
        id: `${m.id}${SEP}${x.id}`,
        nome: varios ? `${m.nome}: ${x.nome}` : x.nome,
        box3d: x.box3d ? transladar(x.box3d, m.posicao) : undefined,
        dependeDe: x.dependeDe ? `${m.id}${SEP}${x.dependeDe}` : undefined,
      });
    ferragens.push(...r.ferragens.filter((f) => !f.pecaId || !removidas.has(f.pecaId)).map((f) => ({ ...f, pecaId: f.pecaId ? `${m.id}${SEP}${f.pecaId}` : undefined, moduloId: m.id })));
    extras.push(...r.extras.filter((e) => !e.pecaId || !removidas.has(e.pecaId)).map((e) => (varios ? { ...e, descricao: `${m.nome}: ${e.descricao}` } : e)));
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

/** id local da peça dentro do módulo ("m2:lateral-esq" → "lateral-esq") */
export const idLocal = (id: string) => (id.includes(SEP) ? id.slice(id.indexOf(SEP) + 1) : id);

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
 * Ajusta a posição nos dois eixos do plano de arraste (padrão x e y) para encostar
 * ou alinhar nas faces das outras caixas quando estiver a menos de `tol` mm.
 * Sem vizinho perto, arredonda para `grade` mm. O terceiro eixo não muda.
 */
export function encaixar(local: Limites, pos: Vec3, outros: Limites[], tol = 40, eixos: [number, number] = [0, 1], grade = 5): Vec3 {
  const melhor = (eixo: number, outro: number): number => {
    const a0 = local.min[eixo];
    const a1 = local.max[eixo];
    const candidatos: number[] = [];
    for (const o of outros) {
      // só encaixa no eixo se as caixas se enxergam no outro eixo (ou estão perto)
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
    let alvo = Math.round(pos[eixo] / grade) * grade;
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
  const out: Vec3 = [...pos];
  out[eixos[0]] = melhor(eixos[0], eixos[1]);
  out[eixos[1]] = melhor(eixos[1], eixos[0]);
  return out;
}

export const templatesDeModulo = () => TEMPLATES.filter((t) => t.id !== 'livre');

// ---------------------------------------------------------------------------
// Peças batendo
// ---------------------------------------------------------------------------
export type Conflito = { tipo: 'sobreposicao' | 'porta'; a: string; b: string; texto: string };

const limitesBox = (p: Peca): Limites => {
  const b = p.box3d!;
  return { min: [b.pos[0] - b.size[0] / 2, b.pos[1] - b.size[1] / 2, b.pos[2] - b.size[2] / 2], max: [b.pos[0] + b.size[0] / 2, b.pos[1] + b.size[1] / 2, b.pos[2] + b.size[2] / 2] };
};
const sobrepoe = (a: Limites, b: Limites, tol = 0.5) => [0, 1, 2].every((i) => Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]) > tol);
const nomeCurtoPeca = (p: Peca) => p.nome;

/**
 * Peças que ocupam o mesmo espaço (mais de 0,5 mm em todas as direções) e portas
 * que não abrem porque o vizinho avança na frente da dobradiça.
 */
export function detectarConflitos(pecas: Peca[]): Conflito[] {
  const comCaixa = pecas.filter((p) => p.box3d);
  const lim = new Map(comCaixa.map((p) => [p.id, limitesBox(p)]));
  const out: Conflito[] = [];
  for (let i = 0; i < comCaixa.length; i++)
    for (let j = i + 1; j < comCaixa.length; j++) {
      const a = comCaixa[i];
      const b = comCaixa[j];
      if (a.dependeDe === b.id || b.dependeDe === a.id) continue;
      if (sobrepoe(lim.get(a.id)!, lim.get(b.id)!)) out.push({ tipo: 'sobreposicao', a: a.id, b: b.id, texto: `${nomeCurtoPeca(a)} bate em ${nomeCurtoPeca(b)}` });
    }

  // portas: ao girar, a borda da dobradiça avança; um vizinho de outro módulo na frente desse ponto impede a abertura
  for (const porta of comCaixa) {
    const d = porta.box3d!.dobradica;
    if (!d) continue;
    const lp = lim.get(porta.id)!;
    const esp = Math.min(...porta.box3d!.size);
    const mid = moduloDaPeca(porta.id);
    for (const o of comCaixa) {
      if (o.id === porta.id || moduloDaPeca(o.id) === mid || o.dependeDe === porta.id) continue;
      const lo = lim.get(o.id)!;
      const ladoX = d.sinal < 0 ? lo.max[0] > d.x - esp - 3 && lo.min[0] < d.x + 0.5 : lo.min[0] < d.x + esp + 3 && lo.max[0] > d.x - 0.5;
      const naFrente = lo.max[2] > d.z + 1;
      const mesmaAltura = Math.min(lo.max[1], lp.max[1]) - Math.max(lo.min[1], lp.min[1]) > 5;
      if (ladoX && naFrente && mesmaAltura && !out.some((c) => c.tipo === 'porta' && c.a === porta.id)) {
        out.push({ tipo: 'porta', a: porta.id, b: o.id, texto: `${nomeCurtoPeca(porta)} não abre: bate em ${nomeCurtoPeca(o)}` });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lateral compartilhada automática
// ---------------------------------------------------------------------------
const dentro = (a0: number, a1: number, b0: number, b1: number) => a0 >= b0 - 1 && a1 <= b1 + 1;

/**
 * Quando dois módulos encostam lado a lado, um deles tira a lateral daquele lado e
 * desliza para usar a lateral do vizinho. Quem cede é o módulo que cabe inteiro na
 * altura do outro (preferindo `preferido`, normalmente o que acabou de ser movido).
 * Se os módulos se separarem, a lateral volta.
 */
export function compartilharLaterais(p: Projeto, ctx: Contexto, preferido?: string): Projeto {
  if (p.templateId === 'livre' || p.compartilharLaterais === false) return p;
  let x = normalizarProjeto(p);
  for (let iter = 0; iter < 8; iter++) {
    const m = montarProjeto(x, ctx);
    const ids = new Set(m.pecas.map((q) => q.id));
    const viz = (mm: ModuloMontado, lado: 'esq' | 'dir') =>
      m.modulos.find(
        (o) =>
          o.modulo.id !== mm.modulo.id &&
          Math.abs(lado === 'esq' ? o.corpo.max[0] - mm.corpo.min[0] : o.corpo.min[0] - mm.corpo.max[0]) < 1 &&
          Math.min(o.corpo.max[1], mm.corpo.max[1]) - Math.max(o.corpo.min[1], mm.corpo.min[1]) > 20 &&
          Math.min(o.corpo.max[2], mm.corpo.max[2]) - Math.max(o.corpo.min[2], mm.corpo.min[2]) > 20,
      );

    // 1) separou: devolve a lateral e desfaz o deslize
    let mudou = false;
    for (const mm of m.modulos) {
      for (const c of mm.modulo.compartilhadas ?? []) {
        if (viz(mm, c.peca === 'lateral-esq' ? 'esq' : 'dir')) continue;
        x = {
          ...x,
          modulos: x.modulos!.map((q) =>
            q.id === mm.modulo.id
              ? { ...q, removidas: (q.removidas ?? []).filter((r) => r !== c.peca), compartilhadas: (q.compartilhadas ?? []).filter((k) => k.peca !== c.peca), posicao: [q.posicao[0] - c.dx, q.posicao[1], q.posicao[2]] as Vec3 }
              : q,
          ),
        };
        mudou = true;
        break;
      }
      if (mudou) break;
    }
    if (mudou) continue;

    // 2) encostou: um dos dois cede a lateral
    for (const a of m.modulos) {
      const b = viz(a, 'dir');
      if (!b) continue;
      const aLat = `${a.modulo.id}${SEP}lateral-dir`;
      const bLat = `${b.modulo.id}${SEP}lateral-esq`;
      if (!ids.has(aLat) || !ids.has(bLat)) continue;
      const bCabe = dentro(b.corpo.min[1], b.corpo.max[1], a.corpo.min[1], a.corpo.max[1]);
      const aCabe = dentro(a.corpo.min[1], a.corpo.max[1], b.corpo.min[1], b.corpo.max[1]);
      if (!aCabe && !bCabe) continue;
      const cede = aCabe && bCabe ? (preferido === a.modulo.id ? a : b) : bCabe ? b : a;
      const lat = m.pecas.find((q) => q.id === (cede === a ? aLat : bLat))!;
      const e = Math.min(...lat.box3d!.size);
      const peca = cede === a ? ('lateral-dir' as const) : ('lateral-esq' as const);
      const dx = cede === a ? e : -e;
      x = {
        ...x,
        modulos: x.modulos!.map((q) =>
          q.id === cede.modulo.id
            ? { ...q, removidas: [...new Set([...(q.removidas ?? []), peca])], compartilhadas: [...(q.compartilhadas ?? []), { peca, dx }], posicao: [q.posicao[0] + dx, q.posicao[1], q.posicao[2]] as Vec3 }
            : q,
        ),
      };
      mudou = true;
      break;
    }
    if (!mudou) break;
  }
  return x;
}

// ---------------------------------------------------------------------------
// Alças: que parâmetro cada eixo do módulo controla
// ---------------------------------------------------------------------------
export function eixosDoModulo(t: Template, p: Params): { eixo: 0 | 1 | 2; param: string }[] {
  const tem = (id: string) => t.parametros.some((d) => d.id === id);
  if (tem('orientacao')) {
    const o = String(p.orientacao ?? 'horizontal');
    if (o === 'lateral') return [{ eixo: 1, param: 'comprimento' }, { eixo: 2, param: 'largura' }];
    if (o === 'frontal') return [{ eixo: 0, param: 'largura' }, { eixo: 1, param: 'comprimento' }];
    return [{ eixo: 0, param: 'comprimento' }, { eixo: 2, param: 'largura' }];
  }
  const out: { eixo: 0 | 1 | 2; param: string }[] = [];
  if (tem('largura')) out.push({ eixo: 0, param: 'largura' });
  else if (tem('comprimento')) out.push({ eixo: 0, param: 'comprimento' });
  if (tem('altura')) out.push({ eixo: 1, param: 'altura' });
  if (tem('profundidade')) out.push({ eixo: 2, param: 'profundidade' });
  return out;
}
