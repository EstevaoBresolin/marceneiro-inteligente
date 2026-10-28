import type { ProjetoMontado } from './composicao';
import { moduloDaPeca } from './composicao';
import type { Catalogo, Config, Orcamento, Peca, Projeto } from './types';

export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function novoOrcamento(config: Config): Orcamento {
  const v = config.venda;
  return {
    numero: config.proximoOrcamento,
    data: hojeISO(),
    validadeDias: v.validadeDias,
    prazoEntregaDias: v.prazoEntregaDias,
    formaPagamento: v.formaPagamento,
    descontoAVistaPercent: v.descontoAVistaPercent,
    observacoes: v.observacoes,
    precoManualCentavos: null,
    detalharItens: true,
    status: 'rascunho',
  };
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const mm = (n: number) => Math.round(n);

/** descrição em linguagem de cliente, a partir das peças do módulo */
export function descreverPecas(pecas: Peca[]): string {
  const conta = (f: (p: Peca) => boolean) => pecas.filter(f).length;
  const gavetas = conta((p) => /gaveta-\d+-frente$/.test(p.id));
  const portas = conta((p) => (p.papel === 'porta' && !/gaveta/.test(p.id)) || (p.papel === 'espelho' && !p.dependeDe));
  const portasEspelho = conta((p) => p.papel === 'espelho' && !p.dependeDe);
  const espelhoColado = conta((p) => p.papel === 'espelho' && !!p.dependeDe);
  const prateleiras = conta((p) => p.papel === 'prateleira');
  const divisorias = conta((p) => p.papel === 'divisoria');
  const fundo = conta((p) => p.papel === 'fundo' && !/gaveta/.test(p.id)) > 0;
  const partes: string[] = [];
  if (portas) partes.push(portasEspelho ? plural(portas, 'porta de espelho', 'portas de espelho') : plural(portas, 'porta', 'portas'));
  if (espelhoColado) partes.push('espelho 4 mm na frente');
  if (gavetas) partes.push(`${plural(gavetas, 'gaveta', 'gavetas')} com corrediça telescópica`);
  if (prateleiras) partes.push(plural(prateleiras, 'prateleira', 'prateleiras'));
  if (divisorias) partes.push(plural(divisorias, 'divisória', 'divisórias'));
  if (!portas && !gavetas) partes.push('aberto na frente');
  if (fundo) partes.push('com fundo');
  const txt = partes.join(', ');
  return txt.charAt(0).toUpperCase() + txt.slice(1) + '.';
}

export function itensDoOrcamento(p: Projeto, m: ProjetoMontado, detalhar: boolean) {
  const lote = Math.max(1, p.quantidadeLote);
  const qtd = lote > 1 ? ` (${lote} unidades)` : '';
  if (!detalhar || m.modulos.length <= 1) {
    const l = m.limites;
    return [
      {
        nome: `${p.nome}${qtd}`,
        descricao: descreverPecas(m.pecas),
        medidas: l ? `${mm(l.max[0] - l.min[0])} × ${mm(l.max[1] - l.min[1])} × ${mm(l.max[2] - l.min[2])} mm` : '',
      },
    ];
  }
  return m.modulos.map((mod) => {
    const l = mod.limitesLocais;
    return {
      nome: `${mod.modulo.nome}${qtd}`,
      descricao: descreverPecas(m.pecas.filter((x) => moduloDaPeca(x.id) === mod.modulo.id)),
      medidas: `${mm(l.max[0] - l.min[0])} × ${mm(l.max[1] - l.min[1])} × ${mm(l.max[2] - l.min[2])} mm`,
    };
  });
}

const OCULTAR_FERRAGENS = new Set(['parafuso-4x40', 'suporte-prateleira']);

/** materiais usados, sem preço: o que o cliente quer saber */
export function materiaisDoOrcamento(m: ProjetoMontado, catalogo: Catalogo): string[] {
  const out: string[] = [];
  const reais = m.pecas.filter((p) => !p.somente3d);
  const porChapa = new Map<string, Set<string>>();
  for (const p of reais) {
    const s = porChapa.get(p.chapaId) ?? new Set<string>();
    s.add(p.papel === 'fundo' ? 'fundo' : p.papel === 'porta' ? 'frentes' : 'corpo');
    porChapa.set(p.chapaId, s);
  }
  for (const [id, usos] of porChapa) {
    const c = catalogo.chapas.find((x) => x.id === id);
    if (!c) continue;
    const u = [...usos];
    const onde = u.length === 3 ? 'Corpo, frentes e fundo' : u.map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(' e ').replace(/ e (\w)/g, (_, l) => ` e ${l.toLowerCase()}`);
    out.push(`${onde} em ${c.nome}`);
  }
  const fitas = new Set<string>();
  for (const p of reais) for (const b of Object.values(p.bordas)) if (b) fitas.add(b);
  const nomesFita = [...fitas].map((id) => catalogo.fitas.find((f) => f.id === id)?.nome).filter(Boolean);
  if (nomesFita.length) out.push(`Bordas acabadas com ${nomesFita.join(' e ')}`);
  const ferr = new Set(m.ferragens.filter((f) => !OCULTAR_FERRAGENS.has(f.ferragemId)).map((f) => catalogo.ferragens.find((x) => x.id === f.ferragemId)?.nome).filter(Boolean) as string[]);
  for (const f of ferr) out.push(f);
  if (m.pecas.some((p) => p.papel === 'espelho')) out.push('Espelho 4 mm');
  return out;
}
