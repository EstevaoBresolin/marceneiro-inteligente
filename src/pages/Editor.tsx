import { AlertTriangle, ArrowLeft, Box, Camera, DoorOpen, Eye, FileDown, FileSpreadsheet, Hand, Image, Layers, MousePointer2, Plus, Redo2, Ruler, Trash2, Undo2 } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CustosView } from '../components/CustosView';
import { OrcamentoView } from '../components/OrcamentoView';
import { novoOrcamento } from '../domain/orcamento';
import { rastrear } from '../lib/telemetria';
import { DesenhosView } from '../components/DesenhosView';
import { ManualView } from '../components/ManualView';
import { numerarPecas } from '../domain/usinagem';
import { Inspetor } from '../components/Inspetor';
import { PainelModulos } from '../components/PainelModulos';
import { TabelaPecas } from '../components/TabelaPecas';
import { Abas, Botao, Campo, DinheiroInput, Interruptor, NumeroInput, TextoInput, cx } from '../components/ui';
import { calcularCustos } from '../costing/calcularCustos';
import { precoSugerido } from '../costing/precoSugerido';
import { PlanoCorteView } from '../cutplan/PlanoCorteView';
import {
  compartilharLaterais,
  detectarConflitos,
  eixosDoModulo,
  idLocal,
  limitesDe,
  montarProjeto,
  moduloDaPeca,
  nomeCurto,
  nomeUnico,
  normalizarProjeto,
  parametrosHerdados,
  posicaoAoLado,
  proximoIdModulo,
  SEP,
  type Lado,
  type Vec3,
} from '../domain/composicao';
import { brl, fmtNum, novoId } from '../domain/money';
import type { Modulo, Orientacao, Peca, Projeto } from '../domain/types';
import { ir } from '../lib/router';
import { usePlanoCorte } from '../lib/usePlanoCorte';
import { useApp } from '../store/app';
import { parametrosIniciais, templatePorId } from '../templates';
import type { AlcaCena, CenaHandle, Ferramenta, OpcoesCena, Selecao, Vista } from '../viewer3d/Scene';

const Cena = lazy(() => import('../viewer3d/Scene').then((m) => ({ default: m.Cena })));

type Aba = 'pecas' | 'desenhos' | 'montagem' | 'corte' | 'custos' | 'orcamento' | 'exportar';

const NADA: Selecao = { modulo: null, peca: null };
const somarV = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function Editor({ id }: { id: string }) {
  const { projetos, catalogo, config, salvarProjeto, carregado, setConfig } = useApp();
  const original = projetos.find((p) => p.id === id);
  const [p, setP] = useState<Projeto | null>(original ? normalizarProjeto(original) : null);
  const [sel, setSel] = useState<Selecao>(NADA);
  const [ferramenta, setFerramenta] = useState<Ferramenta>('cursor');
  const [espaco, setEspaco] = useState(false);
  const [aba, setAba] = useState<Aba>('pecas');
  const [opcoes, setOpcoes] = useState<OpcoesCena>({ portaAberta: false, explodida: false, transparente: false, cotas: true });
  const [vista, setVista] = useState<Vista>('iso');
  const [vistaSeq, setVistaSeq] = useState(0);
  const [exportando, setExportando] = useState<string | null>(null);
  const cena = useRef<CenaHandle>(null);

  // desfazer/refazer: guarda o projeto antes de cada grupo de mudanças (arrastes viram um passo só)
  const passado = useRef<Projeto[]>([]);
  const futuro = useRef<Projeto[]>([]);
  const ultimoPasso = useRef(0);
  const pRef = useRef(p);
  pRef.current = p;
  const [, forcar] = useState(0);

  useEffect(() => {
    if (!p && original) setP(normalizarProjeto(original));
  }, [original, p]);

  // salva com debounce
  useEffect(() => {
    if (!p) return;
    const t = setTimeout(() => salvarProjeto(p), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  const livre = p?.templateId === 'livre';
  const ctx = useMemo(() => ({ catalogo, config }), [catalogo, config]);

  const montado = useMemo(() => (p ? montarProjeto(p, ctx) : null), [p, ctx]);
  const pecas = useMemo(() => montado?.pecas ?? [], [montado]);
  const ferragens = montado?.ferragens ?? [];
  const extras = montado?.extras ?? [];
  const montados = useMemo(() => montado?.modulos ?? [], [montado]);
  const modulosCena = useMemo(() => montados.map((m) => ({ id: m.modulo.id, nome: m.modulo.nome, limitesLocais: m.limitesLocais, posicao: m.modulo.posicao })), [montados]);
  const lote = Math.max(1, p?.quantidadeLote ?? 1);
  const conflitos = useMemo(() => detectarConflitos(pecas), [pecas]);
  const numeros = useMemo(() => numerarPecas(pecas), [pecas]);
  const [exportarManual, setExportarManual] = useState(false);
  const [verConflitos, setVerConflitos] = useState(false);
  const marcadas = useMemo(() => Object.fromEntries(conflitos.flatMap((c) => [[c.a, 'conflito' as const], [c.b, 'conflito' as const]])), [conflitos]);

  // seleção sempre válida
  const selValida: Selecao = useMemo(() => {
    const mod = sel.modulo && montados.some((m) => m.modulo.id === sel.modulo) ? sel.modulo : null;
    const peca = mod && sel.peca && pecas.some((x) => x.id === sel.peca) ? sel.peca : null;
    return { modulo: mod, peca };
  }, [sel, montados, pecas]);
  const modSel = montados.find((m) => m.modulo.id === selValida.modulo) ?? null;
  const pecaSel = pecas.find((x) => x.id === selValida.peca) ?? null;
  const moduloPainel = selValida.modulo ?? montados[0]?.modulo.id ?? null;

  const { plano, calculando } = usePlanoCorte(pecas, lote, catalogo.chapas, config.servico.kerf, config.servico.refilo);
  const custos = useMemo(
    () => calcularCustos({ pecas, lote, ferragens, extras, horasMaoDeObra: p?.horasMaoDeObra ?? 0, plano, catalogo, config }),
    [pecas, lote, ferragens, extras, p?.horasMaoDeObra, plano, catalogo, config],
  );
  const sugerido = precoSugerido(custos.unitarioCentavos, config.venda);

  const atualizar = useCallback((fn: (x: Projeto) => Projeto) => {
    const atual = pRef.current;
    if (!atual) return;
    const agora = Date.now();
    if (agora - ultimoPasso.current > 600) {
      passado.current.push(atual);
      if (passado.current.length > 100) passado.current.shift();
      futuro.current = [];
    }
    ultimoPasso.current = agora;
    setP((x) => (x ? fn(x) : x));
  }, []);

  const desfazer = useCallback(() => {
    const ant = passado.current.pop();
    if (!ant || !pRef.current) return;
    futuro.current.push(pRef.current);
    ultimoPasso.current = 0;
    setP(ant);
    forcar((n) => n + 1);
  }, []);
  const refazer = useCallback(() => {
    const prox = futuro.current.pop();
    if (!prox || !pRef.current) return;
    passado.current.push(pRef.current);
    ultimoPasso.current = 0;
    setP(prox);
    forcar((n) => n + 1);
  }, []);

  // ---------- módulos ----------
  const alterarModulo = useCallback((mid: string, fn: (m: Modulo) => Modulo) => atualizar((x) => ({ ...x, modulos: (x.modulos ?? []).map((m) => (m.id === mid ? fn(m) : m)) })), [atualizar]);
  const semOverridesDe = (x: Projeto, mid: string) => x.pecas.filter((q) => moduloDaPeca(q.id) !== mid);

  const adicionarModulo = (templateId: string, lado: Lado, base?: Modulo) => {
    if (!p) return;
    const t = templatePorId(templateId);
    const vizinho = montados.find((m) => m.modulo.id === moduloPainel) ?? montados[montados.length - 1];
    const params = base ? { ...base.parametros } : parametrosHerdados(t, vizinho, lado, parametrosIniciais(t, config.padroes));
    const local = limitesDe(t.gerar(params, ctx).pecas.flatMap((q) => (q.box3d ? [q.box3d] : []))) ?? { min: [0, 0, 0] as Vec3, max: [0, 0, 0] as Vec3 };
    const mods = p.modulos ?? [];
    const novo: Modulo = {
      id: proximoIdModulo(mods),
      nome: nomeUnico(base ? base.nome : nomeCurto(t.id), mods),
      templateId: t.id,
      parametros: params,
      posicao: posicaoAoLado(vizinho, local, lado),
      ...(base ? { removidas: base.removidas, deslocamentos: base.deslocamentos, pecasExtras: base.pecasExtras } : {}),
    };
    atualizar((x) => compartilharLaterais({ ...x, modulos: [...(x.modulos ?? []), novo], horasMaoDeObra: Math.round((x.horasMaoDeObra + t.horasSugeridas) * 100) / 100 }, ctx, novo.id));
    setSel({ modulo: novo.id, peca: null });
    setVistaSeq((v) => v + 1);
    rastrear('modulo_adicionado', { modelo: t.id, lado, duplicado: !!base });
  };

  const trocarTipo = (mid: string, templateId: string) => {
    const t = templatePorId(templateId);
    atualizar((x) => ({
      ...x,
      pecas: semOverridesDe(x, mid),
      modulos: (x.modulos ?? []).map((m) =>
        m.id === mid
          ? { ...m, templateId: t.id, nome: m.nome === nomeCurto(m.templateId) ? nomeCurto(t.id) : m.nome, parametros: Object.fromEntries(t.parametros.map((d) => [d.id, m.parametros[d.id] ?? d.padrao])), removidas: [], deslocamentos: {} }
          : m,
      ),
    }));
  };

  const removerModulo = (mid: string) => {
    if ((p?.modulos?.length ?? 0) <= 1) return;
    atualizar((x) => ({ ...x, pecas: semOverridesDe(x, mid), modulos: (x.modulos ?? []).filter((m) => m.id !== mid) }));
    setSel(NADA);
  };

  const restaurarModulo = (mid: string) =>
    alterarModulo(mid, (m) => {
      const dx = (m.compartilhadas ?? []).reduce((acc, c) => acc + c.dx, 0);
      return { ...m, removidas: [], deslocamentos: {}, compartilhadas: [], posicao: [m.posicao[0] - dx, m.posicao[1], m.posicao[2]] };
    });

  const reencaixar = () => atualizar((x) => compartilharLaterais(x, ctx, selValida.modulo ?? undefined));

  const alternarCompartilhar = (ligado: boolean) =>
    atualizar((x) => {
      if (ligado) return compartilharLaterais({ ...x, compartilharLaterais: true }, ctx);
      return {
        ...x,
        compartilharLaterais: false,
        modulos: (x.modulos ?? []).map((m) => {
          if (!m.compartilhadas?.length) return m;
          const dx = m.compartilhadas.reduce((acc, c) => acc + c.dx, 0);
          const tiradas = new Set(m.compartilhadas.map((c) => c.peca as string));
          return { ...m, removidas: (m.removidas ?? []).filter((r) => !tiradas.has(r)), compartilhadas: [], posicao: [m.posicao[0] - dx, m.posicao[1], m.posicao[2]] as Vec3 };
        }),
      };
    });

  const duplicarModulo = (mid: string) => {
    const m = montados.find((x) => x.modulo.id === mid);
    if (m) adicionarModulo(m.modulo.templateId, 'direita', m.modulo);
  };

  // ---------- peças ----------
  const ehSolta = (fullId: string) => {
    const mid = moduloDaPeca(fullId);
    return !!p?.modulos?.find((m) => m.id === mid)?.pecasExtras?.some((x) => x.id === idLocal(fullId));
  };

  const removerPeca = (fullId: string) => {
    rastrear('peca_removida', { peca: idLocal(fullId).replace(/-\d+$/, '') });
    if (livre) {
      atualizar((x) => ({ ...x, pecas: x.pecas.filter((q) => q.id !== fullId) }));
      return;
    }
    const mid = moduloDaPeca(fullId);
    if (!mid) return;
    const local = idLocal(fullId);
    atualizar((x) => {
      const modulos = (x.modulos ?? []).map((m) => {
        if (m.id !== mid) return m;
        if (m.pecasExtras?.some((q) => q.id === local)) return { ...m, pecasExtras: m.pecasExtras.filter((q) => q.id !== local) };
        return { ...m, removidas: [...new Set([...(m.removidas ?? []), local])] };
      });
      const prox = { ...x, pecas: x.pecas.filter((q) => q.id !== fullId), modulos };
      // tirou a lateral que encostava num vizinho: o módulo desliza para dividir a lateral do vizinho
      const antes = montarProjeto(x, ctx).modulos;
      const depois = montarProjeto(prox, ctx).modulos;
      const a = antes.find((m) => m.modulo.id === mid);
      const d = depois.find((m) => m.modulo.id === mid);
      if (!a || !d) return prox;
      const encostado = (lado: 0 | 1) =>
        antes.some((o) => o.modulo.id !== mid && Math.abs((lado === 0 ? o.corpo.max[0] : o.corpo.min[0]) - (lado === 0 ? a.corpo.min[0] : a.corpo.max[0])) < 1 && o.corpo.max[1] > a.corpo.min[1] && o.corpo.min[1] < a.corpo.max[1]);
      let dx = 0;
      if (d.corpo.min[0] > a.corpo.min[0] + 0.5 && encostado(0)) dx = a.corpo.min[0] - d.corpo.min[0];
      else if (d.corpo.max[0] < a.corpo.max[0] - 0.5 && encostado(1)) dx = a.corpo.max[0] - d.corpo.max[0];
      if (!dx) return prox;
      return { ...prox, modulos: modulos.map((m) => (m.id === mid ? { ...m, posicao: [m.posicao[0] + dx, m.posicao[1], m.posicao[2]] as Vec3 } : m)) };
    });
    setSel({ modulo: mid, peca: null });
  };

  const moverPeca = useCallback(
    (fullId: string, centro: Vec3) => {
      const mid = moduloDaPeca(fullId);
      const atual = montado?.pecas.find((x) => x.id === fullId)?.box3d?.pos;
      if (!mid || !atual) return;
      const d: Vec3 = [centro[0] - atual[0], centro[1] - atual[1], centro[2] - atual[2]];
      if (!d[0] && !d[1] && !d[2]) return;
      const local = idLocal(fullId);
      alterarModulo(mid, (m) => {
        const solta = m.pecasExtras?.find((q) => q.id === local);
        if (solta?.livre3d) return { ...m, pecasExtras: m.pecasExtras!.map((q) => (q.id === local ? { ...q, livre3d: { ...q.livre3d!, centro: somarV(q.livre3d!.centro, d) } } : q)) };
        const antes = m.deslocamentos?.[local] ?? [0, 0, 0];
        return { ...m, deslocamentos: { ...m.deslocamentos, [local]: somarV(antes, d) } };
      });
    },
    [montado, alterarModulo],
  );

  const voltarLugar = (fullId: string) => {
    const mid = moduloDaPeca(fullId);
    if (!mid) return;
    const local = idLocal(fullId);
    alterarModulo(mid, (m) => {
      const ds = { ...m.deslocamentos };
      delete ds[local];
      return { ...m, deslocamentos: ds };
    });
  };

  const adicionarTabua = (mid: string) => {
    const m = montados.find((x) => x.modulo.id === mid);
    if (!m) return;
    const l = m.limitesLocais;
    const chapaId = String(m.modulo.parametros.chapaId ?? catalogo.chapas[0]?.id ?? '');
    const n = (m.modulo.pecasExtras?.length ?? 0) + 1;
    let k = n;
    while (m.modulo.pecasExtras?.some((q) => q.id === `solta-${k}`)) k++;
    const nova: Peca = {
      id: `solta-${k}`,
      nome: 'Tábua',
      chapaId,
      comprimento: Math.max(100, Math.round(l.max[0] - l.min[0])),
      largura: Math.max(60, Math.round(l.max[2] - l.min[2])),
      quantidade: 1,
      podeGirar: true,
      bordas: { c1: catalogo.fitas[0]?.id ?? null, c2: null, l1: null, l2: null },
      furos: [],
      papel: 'outro',
      livre3d: { orientacao: 'horizontal', centro: [(l.min[0] + l.max[0]) / 2, l.max[1] + 80, (l.min[2] + l.max[2]) / 2] },
    };
    alterarModulo(mid, (mm) => ({ ...mm, pecasExtras: [...(mm.pecasExtras ?? []), nova] }));
    setSel({ modulo: mid, peca: `${mid}${SEP}${nova.id}` });
  };

  const orientar = (fullId: string, o: Orientacao) => {
    const mid = moduloDaPeca(fullId);
    if (!mid) return;
    const local = idLocal(fullId);
    alterarModulo(mid, (m) => ({ ...m, pecasExtras: (m.pecasExtras ?? []).map((q) => (q.id === local && q.livre3d ? { ...q, livre3d: { ...q.livre3d, orientacao: o } } : q)) }));
  };

  const alterarPeca = (peca: Peca) => {
    if (livre) return atualizar((x) => ({ ...x, pecas: x.pecas.map((q) => (q.id === peca.id ? peca : q)) }));
    const mid = moduloDaPeca(peca.id);
    if (mid && ehSolta(peca.id)) {
      const local = idLocal(peca.id);
      const nome = peca.nome.replace(/^.*?: /, '');
      return alterarModulo(mid, (m) => ({ ...m, pecasExtras: (m.pecasExtras ?? []).map((q) => (q.id === local ? { ...q, ...peca, id: local, nome, box3d: undefined, editadaManualmente: false } : q)) }));
    }
    atualizar((x) => ({ ...x, pecas: [...x.pecas.filter((q) => q.id !== peca.id), { ...peca, editadaManualmente: true }] }));
  };

  const destravar = (pid: string) => atualizar((x) => ({ ...x, pecas: x.pecas.filter((q) => q.id !== pid) }));

  const adicionarPecaLivre = () =>
    atualizar((x) => ({
      ...x,
      pecas: [...x.pecas, { id: novoId(), nome: `Peça ${x.pecas.length + 1}`, chapaId: catalogo.chapas[0]?.id ?? '', comprimento: 600, largura: 300, quantidade: 1, podeGirar: true, bordas: { c1: null, c2: null, l1: null, l2: null }, furos: [] }],
    }));

  // ---------- alças de redimensionar ----------
  const inicioAlca = useRef<{ id: string; mod: Modulo; valor: number; borda: number } | null>(null);

  const alcas: AlcaCena[] = (() => {
    if (livre || (espaco ? 'mao' : ferramenta) !== 'cursor') return [];
    const fmt = (v: number) => `${Math.round(v)} mm`;
    // tábua solta selecionada: puxa comprimento e largura
    if (pecaSel?.box3d && pecaSel.livre3d && modSel) {
      const b = pecaSel.box3d;
      const o = pecaSel.livre3d.orientacao;
      const eixos: { eixo: 0 | 1 | 2; campo: 'comprimento' | 'largura' }[] =
        o === 'horizontal' ? [{ eixo: 0, campo: 'comprimento' }, { eixo: 2, campo: 'largura' }] : o === 'lateral' ? [{ eixo: 1, campo: 'comprimento' }, { eixo: 2, campo: 'largura' }] : [{ eixo: 0, campo: 'largura' }, { eixo: 1, campo: 'comprimento' }];
      return eixos.flatMap(({ eixo, campo }) =>
        ([1, -1] as const).map((sinal) => {
          const pos: Vec3 = [...b.pos];
          pos[eixo] += (sinal * b.size[eixo]) / 2;
          return { id: `p|${pecaSel.id}|${eixo}|${sinal}|${campo}`, pos, eixo, sinal, rotulo: `${campo === 'comprimento' ? 'Comprimento' : 'Largura'} ${fmt(pecaSel[campo])}` };
        }),
      );
    }
    if (!modSel || pecaSel) return [];
    const l = modSel.limites;
    const c: Vec3 = [(l.min[0] + l.max[0]) / 2, (l.min[1] + l.max[1]) / 2, (l.min[2] + l.max[2]) / 2];
    return eixosDoModulo(modSel.template, modSel.modulo.parametros).flatMap(({ eixo, param }) => {
      const def = modSel.template.parametros.find((d) => d.id === param);
      const lados: (1 | -1)[] = eixo === 0 ? [1, -1] : [1];
      return lados.map((sinal) => {
        const pos: Vec3 = [...c];
        pos[eixo] = sinal > 0 ? l.max[eixo] : l.min[eixo];
        return { id: `m|${modSel.modulo.id}|${eixo}|${sinal}|${param}`, pos, eixo, sinal, rotulo: `${def?.label ?? param} ${fmt(Number(modSel.modulo.parametros[param]))}` };
      });
    });
  })();

  const puxarAlca = (id: string, delta: number, tol: number, semEncaixe: boolean) => {
    const [tipo, alvo, eixoS, sinalS, campo] = id.split('|');
    const eixo = Number(eixoS) as 0 | 1 | 2;
    const sinal = Number(sinalS) as 1 | -1;
    const mid = tipo === 'm' ? alvo : moduloDaPeca(alvo);
    const mod = p?.modulos?.find((m) => m.id === mid);
    const montadoMod = montados.find((m) => m.modulo.id === mid);
    if (!mod || !montadoMod) return;
    if (!inicioAlca.current || inicioAlca.current.id !== id) {
      if (tipo === 'm') {
        inicioAlca.current = { id, mod, valor: Number(mod.parametros[campo]), borda: sinal > 0 ? montadoMod.limites.max[eixo] : montadoMod.limites.min[eixo] };
      } else {
        const peca = pecas.find((q) => q.id === alvo);
        if (!peca?.box3d) return;
        inicioAlca.current = { id, mod, valor: peca[campo as 'comprimento' | 'largura'], borda: peca.box3d.pos[eixo] + (sinal * peca.box3d.size[eixo]) / 2 };
      }
    }
    const ini = inicioAlca.current;
    // a face anda; encaixa nas faces dos outros módulos
    let borda = ini.borda + delta * sinal;
    let encaixou = false;
    if (!semEncaixe) {
      let melhor = tol;
      for (const o of montados) {
        if (o.modulo.id === mid && tipo === 'm') continue;
        for (const v of [o.limites.min[eixo], o.limites.max[eixo]]) {
          if (Math.abs(v - borda) < melhor) {
            melhor = Math.abs(v - borda);
            borda = v;
            encaixou = true;
          }
        }
      }
    }
    let valor = ini.valor + (borda - ini.borda) * sinal;
    if (!encaixou) valor = Math.round(valor / (semEncaixe ? 1 : 5)) * (semEncaixe ? 1 : 5);
    if (tipo === 'm') {
      const def = templatePorId(ini.mod.templateId).parametros.find((d) => d.id === campo);
      if (def?.min !== undefined) valor = Math.max(def.min, valor);
      if (def?.max !== undefined) valor = Math.min(def.max, valor);
    } else valor = Math.max(30, valor);
    valor = Math.round(valor * 10) / 10;
    const cresceu = valor - ini.valor;
    if (tipo === 'm') {
      alterarModulo(mid!, () => {
        const pos: Vec3 = [...ini.mod.posicao];
        if (eixo === 0) pos[0] = ini.mod.posicao[0] + (cresceu * sinal) / 2;
        return { ...ini.mod, parametros: { ...ini.mod.parametros, [campo]: valor }, posicao: pos };
      });
    } else {
      const local = idLocal(alvo);
      const base = ini.mod.pecasExtras?.find((q) => q.id === local);
      if (!base?.livre3d) return;
      const centro: Vec3 = [...base.livre3d.centro];
      centro[eixo] += (cresceu * sinal) / 2;
      alterarModulo(mid!, (m) => ({ ...m, pecasExtras: (m.pecasExtras ?? []).map((q) => (q.id === local ? { ...base, [campo]: valor, livre3d: { ...base.livre3d!, centro } } : q)) }));
    }
  };

  // ---------- teclado (estilo Figma) ----------
  const teclas = useRef<(e: KeyboardEvent) => void>(() => {});
  teclas.current = (e: KeyboardEvent) => {
    const alvo = e.target as HTMLElement;
    if (alvo.closest('input, textarea, select, [contenteditable=true]')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) refazer();
      else desfazer();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      refazer();
      return;
    }
    if (mod && e.key.toLowerCase() === 'd' && selValida.modulo) {
      e.preventDefault();
      duplicarModulo(selValida.modulo);
      return;
    }
    if (mod) return;
    if (e.key === 'v' || e.key === 'V') setFerramenta('cursor');
    else if (e.key === 'h' || e.key === 'H') setFerramenta('mao');
    else if (e.key === ' ') {
      e.preventDefault();
      setEspaco(true);
    } else if (e.key === 'Escape') setSel(selValida.peca ? { modulo: selValida.modulo, peca: null } : NADA);
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selValida.peca) removerPeca(selValida.peca);
      else if (selValida.modulo) removerModulo(selValida.modulo);
    } else if (e.key.startsWith('Arrow') && (selValida.peca || selValida.modulo)) {
      e.preventDefault();
      const passo = e.shiftKey ? 10 : 1;
      const d: Vec3 = [e.key === 'ArrowRight' ? passo : e.key === 'ArrowLeft' ? -passo : 0, e.key === 'ArrowUp' ? passo : e.key === 'ArrowDown' ? -passo : 0, 0];
      if (selValida.peca && pecaSel?.box3d) moverPeca(selValida.peca, somarV(pecaSel.box3d.pos, d));
      else if (selValida.modulo) alterarModulo(selValida.modulo, (m) => ({ ...m, posicao: somarV(m.posicao, d) }));
    }
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => teclas.current(e);
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') setEspaco(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  if (!carregado) return <div className="p-8 text-tinta-3">Carregando…</div>;
  if (!p)
    return (
      <div className="p-8">
        <p className="mb-3">Este projeto não existe mais.</p>
        <Botao onClick={() => ir('/projetos')}>Ver projetos</Botao>
      </div>
    );

  const capturarImagem = async () => {
    setSel(NADA);
    await new Promise((r) => setTimeout(r, 120));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return cena.current?.capturarPng() ?? null;
  };

  const abrirAba = (a: Aba) => {
    setAba(a);
    rastrear('aba_aberta', { aba: a });
    if (a === 'orcamento' && p && !p.orcamento) {
      const o = novoOrcamento(config);
      setConfig((c) => void (c.proximoOrcamento = o.numero + 1));
      atualizar((x) => ({ ...x, orcamento: o }));
    }
  };

  const exportar = async (tipo: string) => {
    rastrear('exportou', { tipo });
    if (tipo === 'manual') {
      setAba('montagem');
      setExportarManual(true);
      return;
    }
    if (tipo === 'desenhos') {
      setAba('desenhos');
      return;
    }
    setExportando(tipo);
    try {
      const { baixar, csvListaCorte, pdfOrcamento, pdfPlanoCorte } = await import('../export/exportar');
      const lim = montado?.limites;
      if (tipo === 'corte') await pdfPlanoCorte({ projeto: p.nome, plano, pecas, fitas: catalogo.fitas, lote });
      if (tipo === 'orcamento')
        await pdfOrcamento({
          projeto: p.nome,
          imagemPng: cena.current?.capturarPng() ?? null,
          dimensoes: lim ? { largura: Math.round(lim.max[0] - lim.min[0]), altura: Math.round(lim.max[1] - lim.min[1]), profundidade: Math.round(lim.max[2] - lim.min[2]) } : undefined,
          pecas,
          chapas: catalogo.chapas,
          fitas: catalogo.fitas,
          custos,
          venda: config.venda,
        });
      if (tipo === 'csv') csvListaCorte(p.nome, pecas, catalogo.chapas, catalogo.fitas, lote);
      if (tipo === 'png') {
        const png = cena.current?.capturarPng();
        if (png) baixar(Uint8Array.from(atob(png.split(',')[1]), (c) => c.charCodeAt(0)), `${p.nome}.png`, 'image/png');
      }
    } finally {
      setExportando(null);
    }
  };

  const totalChapas = plano.grupos.reduce((s, g) => s + g.chapas.length, 0);
  const aproveit = plano.grupos.reduce((s, g) => s + g.aproveitamentoMedio * g.chapas.length, 0) / Math.max(1, totalChapas);
  const ferramentaAtiva: Ferramenta = espaco ? 'mao' : ferramenta;

  const toggle = (k: keyof OpcoesCena, icone: React.ReactNode, label: string) => (
    <button
      onClick={() => setOpcoes((o) => ({ ...o, [k]: !o[k] }))}
      aria-pressed={opcoes[k]}
      title={label}
      className={cx('flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium', opcoes[k] ? 'bg-aco text-white' : 'border border-linha bg-painel/90 text-tinta-2 hover:text-tinta')}
    >
      {icone}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );

  const botaoFerramenta = (f: Ferramenta, icone: React.ReactNode, titulo: string) => (
    <button
      onClick={() => setFerramenta(f)}
      aria-pressed={ferramentaAtiva === f}
      title={titulo}
      className={cx('grid size-8 place-items-center rounded', ferramentaAtiva === f ? 'bg-tinta text-white' : 'text-tinta-2 hover:bg-painel-2 hover:text-tinta')}
    >
      {icone}
    </button>
  );

  const local = pecaSel ? idLocal(pecaSel.id) : null;
  const deslocada = !!(local && modSel?.modulo.deslocamentos?.[local]);

  return (
    <div className="flex min-h-[calc(100vh-52px)] flex-col">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* ------------ parâmetros ------------ */}
        <aside className="border-b border-linha bg-painel lg:sticky lg:top-[52px] lg:h-[calc(100vh-52px-56px)] lg:w-[300px] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="space-y-5 p-4">
            <div>
              <button onClick={() => ir('/projetos')} className="mb-2 flex items-center gap-1 text-[13px] text-tinta-3 hover:text-tinta">
                <ArrowLeft className="size-4" /> Projetos
              </button>
              <TextoInput ariaLabel="Nome do projeto" className="h-10 font-cond text-lg font-semibold" valor={p.nome} onChange={(v) => atualizar((x) => ({ ...x, nome: v }))} />
            </div>

            {livre ? (
              <p className="text-[13px] text-tinta-3">Lista livre: adicione as peças na tabela ao lado.</p>
            ) : (
              <PainelModulos
                montados={montados}
                selecionado={moduloPainel}
                onSelecionar={(mid) => setSel({ modulo: mid, peca: null })}
                onAlterar={alterarModulo}
                onTrocarTipo={trocarTipo}
                onAdicionar={(tid, lado) => adicionarModulo(tid, lado)}
                onDuplicar={duplicarModulo}
                onRemover={removerModulo}
                onRestaurar={restaurarModulo}
                catalogo={catalogo}
              />
            )}

            {!livre && montados.length > 1 && (
              <div className="border-t border-linha pt-3">
                <Interruptor label="Módulos encostados dividem a lateral" ligado={p.compartilharLaterais !== false} onChange={alternarCompartilhar} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-linha pt-4">
              <Campo label="Lote" unidade="un.">
                <NumeroInput ariaLabel="Quantidade a produzir" valor={p.quantidadeLote} min={1} max={500} onChange={(v) => atualizar((x) => ({ ...x, quantidadeLote: Math.max(1, Math.round(v)) }))} />
              </Campo>
              <Campo label="Mão de obra" unidade="h/un.">
                <NumeroInput ariaLabel="Horas de mão de obra por unidade" valor={p.horasMaoDeObra} min={0} passo={0.25} onChange={(v) => atualizar((x) => ({ ...x, horasMaoDeObra: v }))} />
              </Campo>
            </div>

            <div className="border-t border-linha pt-4">
              <div className="mb-2 text-[13px] text-tinta-2">Outros custos por unidade</div>
              {p.extras.map((ex, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <TextoInput ariaLabel="Descrição" className="h-8" valor={ex.descricao} onChange={(v) => atualizar((x) => ({ ...x, extras: x.extras.map((e, j) => (j === i ? { ...e, descricao: v } : e)) }))} />
                  <div className="w-28 shrink-0">
                    <DinheiroInput ariaLabel="Valor" centavos={ex.custoCentavos} onChange={(v) => atualizar((x) => ({ ...x, extras: x.extras.map((e, j) => (j === i ? { ...e, custoCentavos: v } : e)) }))} />
                  </div>
                  <button aria-label="Remover custo" className="text-tinta-3 hover:text-perigo" onClick={() => atualizar((x) => ({ ...x, extras: x.extras.filter((_, j) => j !== i) }))}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button className="flex items-center gap-1 text-[13px] font-medium text-aco hover:underline" onClick={() => atualizar((x) => ({ ...x, extras: [...x.extras, { descricao: 'Embalagem', custoCentavos: 500 }] }))}>
                <Plus className="size-4" /> Adicionar custo (embalagem, etiqueta…)
              </button>
            </div>
          </div>
        </aside>

        {/* ------------ 3D + abas ------------ */}
        <main className="flex min-w-0 flex-1 flex-col">
          {!livre && (
            <div className="relative isolate h-[50vh] min-h-[340px] border-b border-linha lg:h-[56vh]">
              <Suspense fallback={<div className="grid h-full place-items-center text-tinta-3">Carregando 3D…</div>}>
                <Cena
                  ref={cena}
                  pecas={pecas}
                  chapas={catalogo.chapas}
                  limites={montado?.limites ?? null}
                  modulos={modulosCena}
                  ferramenta={ferramentaAtiva}
                  sel={selValida}
                  onSelecionar={setSel}
                  onMoverModulo={(mid, pos) => alterarModulo(mid, (m) => ({ ...m, posicao: pos }))}
                  onMoverPeca={moverPeca}
                  onFimArraste={reencaixar}
                  alcas={alcas}
                  onAlca={puxarAlca}
                  onAlcaFim={() => {
                    inicioAlca.current = null;
                    reencaixar();
                  }}
                  marcadas={marcadas}
                  opcoes={opcoes}
                  vista={vista}
                  vistaSeq={vistaSeq}
                />
              </Suspense>

              {/* ferramentas */}
              <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                <div className="flex rounded-md border border-linha bg-painel/95 p-0.5">
                  {botaoFerramenta('cursor', <MousePointer2 className="size-4" />, 'Selecionar e mover (V)')}
                  {botaoFerramenta('mao', <Hand className="size-4" />, 'Mão: girar a vista (H ou segure espaço)')}
                </div>
                <div className="flex rounded-md border border-linha bg-painel/95 p-0.5">
                  <button title="Desfazer (Ctrl+Z)" onClick={desfazer} disabled={!passado.current.length} className="grid size-8 place-items-center rounded text-tinta-2 hover:bg-painel-2 disabled:opacity-30">
                    <Undo2 className="size-4" />
                  </button>
                  <button title="Refazer (Ctrl+Shift+Z)" onClick={refazer} disabled={!futuro.current.length} className="grid size-8 place-items-center rounded text-tinta-2 hover:bg-painel-2 disabled:opacity-30">
                    <Redo2 className="size-4" />
                  </button>
                </div>
                {toggle('portaAberta', <DoorOpen className="size-4" />, 'Abrir portas')}
                {toggle('explodida', <Layers className="size-4" />, 'Explodir')}
                {toggle('transparente', <Eye className="size-4" />, 'Ver dentro')}
                {toggle('cotas', <Ruler className="size-4" />, 'Cotas')}
              </div>
              {conflitos.length > 0 && (
                <div className="absolute left-1/2 top-14 z-10 w-[min(420px,calc(100%-24px))] -translate-x-1/2">
                  <button
                    onClick={() => setVerConflitos((v) => !v)}
                    aria-expanded={verConflitos}
                    className="mx-auto flex items-center gap-1.5 rounded-md bg-[#fbeeeb] px-3 py-1.5 text-[12px] font-medium text-perigo shadow-[0_0_0_1px_rgba(179,65,47,.3)]"
                  >
                    <AlertTriangle className="size-4" />
                    {conflitos.length === 1 ? '1 problema no projeto' : `${conflitos.length} problemas no projeto`}
                  </button>
                  {verConflitos && (
                    <ul className="mt-1 max-h-48 overflow-auto rounded-md border border-linha bg-painel text-[12px] shadow-[0_6px_24px_rgba(34,40,43,.12)]">
                      {conflitos.map((c, i) => (
                        <li key={i}>
                          <button className="block w-full px-3 py-1.5 text-left hover:bg-painel-2" onClick={() => setSel({ modulo: moduloDaPeca(c.a), peca: c.a })}>
                            {c.texto}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="absolute right-3 top-3 flex rounded-md border border-linha bg-painel/90 p-0.5">
                {(['iso', 'frente', 'lado', 'topo'] as Vista[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setVista(v);
                      setVistaSeq((s) => s + 1);
                    }}
                    className={cx('h-7 rounded px-2 text-[12px]', vista === v ? 'bg-aco-claro font-medium text-aco' : 'text-tinta-2 hover:text-tinta')}
                  >
                    {{ iso: '3D', frente: 'Frente', lado: 'Lado', topo: 'Topo' }[v]}
                  </button>
                ))}
              </div>

              <Inspetor
                peca={pecaSel}
                modulo={modSel}
                chapas={catalogo.chapas}
                deslocada={deslocada}
                solta={!!pecaSel && ehSolta(pecaSel.id)}
                varios={montados.length > 1}
                onRemoverPeca={() => pecaSel && removerPeca(pecaSel.id)}
                onVoltarLugar={() => pecaSel && voltarLugar(pecaSel.id)}
                onOrientacao={(o) => pecaSel && orientar(pecaSel.id, o)}
                onAdicionarTabua={() => modSel && adicionarTabua(modSel.modulo.id)}
                onDuplicarModulo={() => modSel && duplicarModulo(modSel.modulo.id)}
                onRemoverModulo={() => modSel && removerModulo(modSel.modulo.id)}
              />
              {!modSel && montado?.limites && (
                <div className="absolute bottom-3 left-3 rounded-md border border-linha bg-painel/90 px-2 py-1 text-[12px] text-tinta-2 num">
                  {[0, 1, 2].map((i) => Math.round(montado.limites!.max[i] - montado.limites!.min[i])).join(' × ')} mm
                </div>
              )}
              <div className={cx('pointer-events-none absolute bottom-3 left-1/2 hidden max-w-[60%] -translate-x-1/2 rounded bg-painel/80 px-2 py-1 text-center text-[11px] text-tinta-3', !modSel && 'lg:block')}>
                {ferramentaAtiva === 'cursor'
                  ? 'Clique: módulo. De novo: peça. Arraste para mover (Alt solta o encaixe). Botão direito gira, rodinha aproxima.'
                  : 'Arraste para girar, botão direito move a vista. V volta para o cursor.'}
              </div>
              <button onClick={() => exportar('png')} title="Salvar imagem" className="absolute bottom-3 right-3 flex h-8 items-center gap-1.5 rounded-md border border-linha bg-painel/90 px-2 text-[12px] text-tinta-2 hover:text-tinta">
                <Camera className="size-4" /> Imagem
              </button>
            </div>
          )}

          <div className="flex-1 bg-painel">
            <Abas<Aba>
              valor={aba}
              onChange={abrirAba}
              abas={[
                { id: 'pecas', label: `Peças (${pecas.filter((x) => !x.somente3d).reduce((s, x) => s + x.quantidade, 0)})` },
                ...(livre ? [] : [{ id: 'desenhos' as const, label: 'Desenhos' }, { id: 'montagem' as const, label: 'Montagem' }]),
                { id: 'corte', label: <>Plano de corte{calculando && <span className="ml-1.5 inline-block size-1.5 animate-pulse rounded-full bg-mdf align-middle" />}</> },
                { id: 'custos', label: 'Custos' },
                { id: 'orcamento', label: 'Orçamento' },
                { id: 'exportar', label: 'Exportar' },
              ]}
            />
            {aba === 'pecas' && (
              <>
                {(livre ? [null] : montados).map((m) => (
                  <section key={m?.modulo.id ?? 'livre'} className="border-b border-linha last:border-0">
                    {m && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pt-3">
                        <button onClick={() => setSel({ modulo: m.modulo.id, peca: null })} className={cx('font-cond text-[15px] font-semibold', m.modulo.id === selValida.modulo ? 'text-aco' : 'text-tinta')}>
                          {m.modulo.nome}
                        </button>
                        <button className="flex items-center gap-1 text-[12px] font-medium text-aco hover:underline" onClick={() => adicionarTabua(m.modulo.id)}>
                          <Plus className="size-3.5" /> Tábua solta
                        </button>
                        {m.removidas > 0 && (
                          <button className="text-[12px] text-tinta-3 hover:text-tinta" onClick={() => restaurarModulo(m.modulo.id)}>
                            {m.removidas} removida(s) · restaurar
                          </button>
                        )}
                      </div>
                    )}
                    <TabelaPecas
                      pecas={m ? pecas.filter((q) => q.id.startsWith(m.modulo.id + SEP)) : pecas}
                      chapas={catalogo.chapas}
                      fitas={catalogo.fitas}
                      lote={lote}
                      selecionada={selValida.peca}
                      onSelecionar={(pid) => setSel(pid ? { modulo: moduloDaPeca(pid), peca: pid } : { modulo: selValida.modulo, peca: null })}
                      onAlterar={alterarPeca}
                      onAdicionar={livre ? adicionarPecaLivre : undefined}
                      onRemover={removerPeca}
                      onDestravar={livre ? undefined : destravar}
                      numeros={numeros}
                    />
                  </section>
                ))}
                {!livre && pecas.some((x) => x.editadaManualmente) && <p className="px-3 pb-3 text-[12px] text-tinta-3">Peças com cadeado foram editadas à mão e não mudam quando você altera as medidas do móvel.</p>}
                {ferragens.length > 0 && (
                  <div className="border-t border-linha px-3 py-3 text-[13px]">
                    <span className="text-tinta-3">Ferragens por unidade: </span>
                    {Object.entries(
                      ferragens.reduce<Record<string, number>>((acc, f) => {
                        acc[f.ferragemId] = (acc[f.ferragemId] ?? 0) + f.quantidade;
                        return acc;
                      }, {}),
                    )
                      .map(([fid, q]) => {
                        const fer = catalogo.ferragens.find((x) => x.id === fid);
                        return fer ? `${q}× ${fer.nome}` : null;
                      })
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                )}
              </>
            )}
            {aba === 'desenhos' && <DesenhosView pecas={pecas} numeros={numeros} catalogo={catalogo} projeto={p.nome} />}
            {aba === 'montagem' && montado && (
              <ManualView montado={montado} catalogo={catalogo} numeros={numeros} projeto={p.nome} exportarAoAbrir={exportarManual} onExportado={() => setExportarManual(false)} />
            )}
            {aba === 'corte' && <PlanoCorteView plano={plano} pecas={pecas} fitas={catalogo.fitas} calculando={calculando} />}
            {aba === 'custos' && <CustosView custos={custos} venda={config.venda} />}
            {aba === 'orcamento' && p.orcamento && montado && (
              <OrcamentoView
                projeto={p}
                orcamento={p.orcamento}
                montado={montado}
                custos={custos}
                config={config}
                catalogo={catalogo}
                onCliente={(c) => atualizar((x) => ({ ...x, cliente: c }))}
                onOrcamento={(o) => atualizar((x) => ({ ...x, orcamento: o }))}
                capturarImagem={capturarImagem}
              />
            )}
            {aba === 'exportar' && (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { id: 'corte', icone: <FileDown className="size-5" />, titulo: 'Plano de corte (PDF)', texto: 'Uma chapa por página, com legenda e fitas. Para mandar à marcenaria.' },
                  { id: 'orcamento', icone: <FileDown className="size-5" />, titulo: 'Ficha de custos (PDF)', texto: 'Uso interno: imagem 3D, peças, custos linha a linha e preço sugerido.' },
                  { id: 'desenhos', icone: <FileDown className="size-5" />, titulo: 'Desenhos com furação (PDF)', texto: 'Cada peça com medidas, fita e a posição de cada furo.' },
                  { id: 'manual', icone: <FileDown className="size-5" />, titulo: 'Manual de montagem (PDF)', texto: 'Passo a passo com imagem 3D de cada etapa.' },
                  { id: 'csv', icone: <FileSpreadsheet className="size-5" />, titulo: 'Lista de corte (CSV)', texto: 'Abre no Excel ou em outro programa de corte.' },
                  { id: 'png', icone: <Image className="size-5" />, titulo: 'Imagem do 3D (PNG)', texto: 'Para anúncio ou para mostrar ao cliente.' },
                ]
                  .filter((x) => !(livre && ['png', 'desenhos', 'manual'].includes(x.id)))
                  .map((x) => (
                    <button key={x.id} onClick={() => exportar(x.id)} disabled={!!exportando} className="rounded-lg border border-linha p-4 text-left hover:border-aco hover:bg-aco-claro/40 disabled:opacity-50">
                      <div className="mb-2 text-aco">{x.icone}</div>
                      <div className="font-medium">{exportando === x.id ? 'Gerando…' : x.titulo}</div>
                      <div className="mt-1 text-[13px] text-tinta-3">{x.texto}</div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ------------ rodapé fixo ------------ */}
      <footer className="sticky bottom-0 z-10 flex h-14 items-center gap-6 overflow-x-auto border-t border-linha bg-tinta px-4 text-white">
        <Box className="size-4 shrink-0 text-mdf" />
        {[
          ['Custo por unidade', brl(custos.unitarioCentavos)],
          ['Preço sugerido', sugerido === null ? '—' : brl(sugerido)],
          ['Chapas', calculando && !totalChapas ? '…' : String(totalChapas)],
          ['Aproveitamento', totalChapas ? `${fmtNum(aproveit * 100, 0)}%` : '—'],
          ...(lote > 1 ? [['Lote', `${lote} un. · ${brl(custos.totalLoteCentavos)}`]] : []),
        ].map(([k, v]) => (
          <div key={k} className="shrink-0">
            <div className="text-[11px] text-white/55">{k}</div>
            <div className={cx('font-cond text-[17px] font-semibold leading-tight num', k === 'Preço sugerido' && 'text-[#e9d8c3]')}>{v}</div>
          </div>
        ))}
      </footer>
    </div>
  );
}
