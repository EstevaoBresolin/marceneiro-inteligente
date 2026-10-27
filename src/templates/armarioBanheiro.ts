import { brl, fmtNum } from '../domain/money';
import type { Extra, ItemFerragem, Peca } from '../domain/types';
import { bordas, caixa, chapaPorId, distribuir, dobradicasPorPorta, FUNDO_CHAPA, fitaPorId, montarCaixa, peca } from './comum';
import { bool, num, str, type Contexto, type ParamDef, type Params, type ResultadoTemplate, type Template } from './types';

const ESPESSURA_ESPELHO = 4;

const PARAMS_ARMARIO: ParamDef[] = [
  { id: 'largura', label: 'Largura', tipo: 'numero', padrao: 500, unidade: 'mm', min: 200, max: 2400, passo: 10 },
  { id: 'altura', label: 'Altura', tipo: 'numero', padrao: 600, unidade: 'mm', min: 250, max: 2400, passo: 10 },
  { id: 'profundidade', label: 'Profundidade', tipo: 'numero', padrao: 150, unidade: 'mm', min: 80, max: 650, passo: 5, dica: 'Profundidade do corpo, sem a porta.' },
  { id: 'chapaId', label: 'Chapa do corpo', tipo: 'chapa', padrao: 'mdf-branco-15' },
  { id: 'prateleiras', label: 'Prateleiras internas', tipo: 'numero', padrao: 2, min: 0, max: 8, passo: 1 },
  { id: 'portas', label: 'Portas', tipo: 'opcoes', padrao: '1', opcoes: [{ valor: '1', label: '1 porta' }, { valor: '2', label: '2 portas' }] },
  {
    id: 'espelho',
    label: 'Espelho',
    tipo: 'opcoes',
    padrao: 'colado',
    opcoes: [
      { valor: 'colado', label: 'Colado na porta de MDF' },
      { valor: 'porta_espelho', label: 'Porta de espelho (dobradiça de vidro)' },
      { valor: 'sem', label: 'Sem espelho' },
    ],
  },
  { id: 'nicho', label: 'Nicho aberto embaixo', tipo: 'booleano', padrao: false },
  { id: 'alturaNicho', label: 'Altura livre do nicho', tipo: 'numero', padrao: 120, unidade: 'mm', min: 60, max: 600, passo: 10, mostrarSe: (p) => bool(p, 'nicho') },
  { id: 'puxador', label: 'Puxador', tipo: 'booleano', padrao: false, dica: 'Desligado = abertura por toque/ponta da porta.' },
  { id: 'fitaId', label: 'Fita de borda', tipo: 'fita', padrao: 'fita-branca-22', avancado: true },
  {
    id: 'fundo',
    label: 'Fundo',
    tipo: 'opcoes',
    padrao: 'hdf3',
    avancado: true,
    opcoes: [
      { valor: 'hdf3', label: 'HDF 3mm' },
      { valor: 'mdf6', label: 'MDF 6mm' },
      { valor: 'sem', label: 'Sem fundo' },
    ],
  },
  {
    id: 'fixacaoFundo',
    label: 'Fixação do fundo',
    tipo: 'opcoes',
    padrao: 'pregado',
    avancado: true,
    opcoes: [
      { valor: 'pregado', label: 'Pregado atrás (sobreposto)' },
      { valor: 'embutido', label: 'Embutido entre as laterais' },
    ],
    mostrarSe: (p) => str(p, 'fundo') !== 'sem',
  },
  {
    id: 'montagem',
    label: 'Montagem',
    tipo: 'opcoes',
    padrao: 'laterais_inteiras',
    avancado: true,
    opcoes: [
      { valor: 'laterais_inteiras', label: 'Laterais inteiras (tampo e base entre elas)' },
      { valor: 'tampo_sobre', label: 'Tampo e base sobre as laterais' },
    ],
  },
  { id: 'folgaPorta', label: 'Folga da porta', tipo: 'numero', padrao: 2, unidade: 'mm', min: 0, max: 10, passo: 0.5, avancado: true },
  { id: 'recuoPrateleira', label: 'Recuo das prateleiras', tipo: 'numero', padrao: 20, unidade: 'mm', min: 0, max: 100, passo: 5, avancado: true },
];

function validarArmario(p: Params, { catalogo }: Contexto) {
  const erros: string[] = [];
  const chapa = catalogo.chapas.find((c) => c.id === str(p, 'chapaId'));
  if (!chapa) return ['Escolha uma chapa válida para o corpo.'];
  const e = chapa.espessura;
  const A = num(p, 'altura');
  const L = num(p, 'largura');
  if (L < 2 * e + 100) erros.push('Largura muito pequena para a espessura da chapa.');
  if (bool(p, 'nicho') && num(p, 'alturaNicho') > A - 3 * e - 100 - num(p, 'rodape')) erros.push('O nicho ocupa quase toda a altura — diminua a altura do nicho.');
  const fundo = FUNDO_CHAPA[str(p, 'fundo')];
  if (fundo && !catalogo.chapas.find((c) => c.id === fundo)) erros.push('A chapa do fundo não existe no catálogo.');
  return erros;
}

/** Corpo + prateleiras + portas. Usado pelo armário de banheiro e pelo armário com portas. */
export function gerarArmario(p: Params, { catalogo, config, removidas }: Contexto): ResultadoTemplate {
  const chapa = chapaPorId(catalogo, str(p, 'chapaId'));
  const fita = fitaPorId(catalogo, str(p, 'fitaId'));
  const L = num(p, 'largura');
  const A = num(p, 'altura');
  const P = num(p, 'profundidade');
  const n = Math.max(0, Math.round(num(p, 'prateleiras')));
  const nPortas = str(p, 'portas') === '2' ? 2 : str(p, 'portas') === '0' ? 0 : 1;
  const espelho = str(p, 'espelho') || 'sem';
  const temNicho = bool(p, 'nicho');
  const hn = temNicho ? num(p, 'alturaNicho') : 0;
  const f = num(p, 'folgaPorta');
  const recuo = num(p, 'recuoPrateleira');
  const fundoId = FUNDO_CHAPA[str(p, 'fundo')] ?? null;
  const fundo = fundoId ? catalogo.chapas.find((c) => c.id === fundoId) : undefined;

  const cx = montarCaixa({
    L,
    A,
    P,
    chapa,
    fita,
    montagem: str(p, 'montagem') === 'tampo_sobre' ? 'tampo_sobre' : 'laterais_inteiras',
    fundo,
    fundoEmbutido: str(p, 'fixacaoFundo') === 'embutido',
    rodape: num(p, 'rodape'),
    juntasExtras: temNicho ? 1 : 0,
    removidas,
  });
  const { e, zb } = cx;
  const pecas: Peca[] = [...cx.pecas];
  const ferragens: ItemFerragem[] = [];
  const extras: Extra[] = [];

  // ---------- divisória do nicho ----------
  let yInterior = cx.yi0;
  if (temNicho) {
    const yDiv = cx.yi0 + hn;
    pecas.push(peca({ id: 'divisoria', nome: 'Divisória do nicho', papel: 'divisoria', chapa, comprimento: L - 2 * e, largura: P - zb, bordas: bordas(fita, { c1: true }), furos: [{ tipo: 'cavilha_8', quantidade: 4 }], box3d: caixa(cx.xi0, cx.xi1, yDiv, yDiv + e, zb, P) }));
    yInterior = yDiv + e;
  }

  // ---------- prateleiras (móveis, sobre pinos) ----------
  if (n > 0) {
    const profPrat = P - cx.zInt - recuo;
    const largPrat = L - 2 * e - 2; // 1 mm de folga de cada lado
    distribuir(yInterior, cx.yi1, n, e).forEach((y, k) => {
      const id = `prateleira-${k + 1}`;
      pecas.push(peca({ id, nome: 'Prateleira', papel: 'prateleira', chapa, comprimento: largPrat, largura: profPrat, bordas: bordas(fita, { c1: true }), box3d: caixa(-largPrat / 2, largPrat / 2, y, y + e, cx.zInt, cx.zInt + profPrat) }));
      ferragens.push({ ferragemId: 'suporte-prateleira', quantidade: 4, pecaId: id });
    });
    cx.lateralEsq.furos.push({ tipo: 'outro', quantidade: 2 * n });
    cx.lateralDir.furos.push({ tipo: 'outro', quantidade: 2 * n });
  }

  // ---------- portas ----------
  const x0 = -L / 2;
  const x1 = L / 2;
  const yPorta0 = (temNicho ? cx.yi0 + hn : cx.yBase) + f;
  const yPorta1 = A - f;
  const hPorta = Math.floor(yPorta1 - yPorta0);
  const wPorta = Math.floor(nPortas === 1 ? L - 2 * f : (L - 3 * f) / 2);
  const nDob = dobradicasPorPorta(hPorta);
  const portaDeEspelho = espelho === 'porta_espelho';
  const espPorta = portaDeEspelho ? ESPESSURA_ESPELHO : e;
  const m = 3; // espelho colado fica 3 mm menor que a porta em cada lado

  const portasX: { xa: number; xb: number; xHinge: number; sinal: 1 | -1; nome: string }[] =
    nPortas === 0
      ? []
      : nPortas === 1
        ? [{ xa: x0 + f, xb: x0 + f + wPorta, xHinge: x0 + f, sinal: -1, nome: 'Porta' }]
        : [
            { xa: x0 + f, xb: x0 + f + wPorta, xHinge: x0 + f, sinal: -1, nome: 'Porta esquerda' },
            { xa: x1 - f - wPorta, xb: x1 - f, xHinge: x1 - f, sinal: 1, nome: 'Porta direita' },
          ];

  portasX.forEach((px, i) => {
    const box = caixa(px.xa, px.xb, yPorta0, yPorta0 + hPorta, P, P + espPorta);
    box.dobradica = { x: px.xHinge, z: P, sinal: px.sinal };
    const id = `porta-${i + 1}`;
    if (portaDeEspelho) {
      pecas.push({ ...peca({ id, nome: px.nome.replace('Porta', 'Porta de espelho'), papel: 'espelho', chapa, comprimento: hPorta, largura: wPorta, box3d: box, podeGirar: false }), somente3d: true, quantidade: 0 });
      ferragens.push({ ferragemId: 'dobradica-vidro', quantidade: nDob, pecaId: id });
      const area = (wPorta * hPorta) / 1e6;
      extras.push({ descricao: 'Espelho 4mm (porta, lapidado e furado)', detalhe: `${fmtNum(area, 3)} m² × ${brl(config.servico.espelhoM2Centavos)}/m²`, custoCentavos: Math.round(area * config.servico.espelhoM2Centavos), pecaId: id });
      return;
    }
    pecas.push(
      peca({
        id,
        nome: px.nome,
        papel: 'porta',
        chapa,
        comprimento: hPorta,
        largura: wPorta,
        bordas: bordas(fita, { c1: true, c2: true, l1: true, l2: true }),
        furos: [{ tipo: 'dobradica_35', quantidade: nDob }, { tipo: 'puxador', quantidade: bool(p, 'puxador') ? 1 : 0 }],
        box3d: box,
      }),
    );
    ferragens.push({ ferragemId: 'dobradica-35', quantidade: nDob, pecaId: id });
    if (bool(p, 'puxador')) ferragens.push({ ferragemId: 'puxador', quantidade: 1, pecaId: id });
    if (espelho === 'colado') {
      const bx = caixa(px.xa + m, px.xb - m, yPorta0 + m, yPorta0 + hPorta - m, P + e, P + e + ESPESSURA_ESPELHO);
      bx.dobradica = box.dobradica;
      const eid = `espelho-${i + 1}`;
      pecas.push({ ...peca({ id: eid, nome: 'Espelho', papel: 'espelho', chapa, comprimento: hPorta - 2 * m, largura: wPorta - 2 * m, box3d: bx, podeGirar: false }), somente3d: true, quantidade: 0, dependeDe: id });
      const area = ((wPorta - 2 * m) * (hPorta - 2 * m)) / 1e6;
      extras.push({ descricao: 'Espelho 4mm (colado na porta)', detalhe: `${fmtNum(area, 3)} m² × ${brl(config.servico.espelhoM2Centavos)}/m²`, custoCentavos: Math.round(area * config.servico.espelhoM2Centavos), pecaId: eid });
    }
  });

  ferragens.push({ ferragemId: 'parafuso-4x40', quantidade: fundo && str(p, 'fixacaoFundo') !== 'embutido' ? 16 : 8 });
  ferragens.push({ ferragemId: 'suporte-parede', quantidade: 1 });

  return { pecas, ferragens, extras, dimensoes: { largura: L, altura: A, profundidade: P + espPorta } };
}

export const armarioBanheiro: Template = {
  id: 'armario-banheiro',
  nome: 'Armário de banheiro com espelho',
  descricao: 'Armarinho suspenso com prateleiras internas e porta com espelho.',
  categoria: 'Com portas',
  horasSugeridas: 1.5,
  parametros: PARAMS_ARMARIO,
  validar: validarArmario,
  gerar: gerarArmario,
};

export const armarioPortas: Template = {
  id: 'armario-portas',
  nome: 'Armário com portas',
  descricao: 'Caixa com portas e prateleiras, com rodapé opcional. Serve para aéreo, balcão, roupeiro pequeno.',
  categoria: 'Com portas',
  horasSugeridas: 1.5,
  parametros: [
    ...PARAMS_ARMARIO.filter((d) => !['espelho', 'nicho', 'alturaNicho'].includes(d.id)).map((d) => {
      if (d.id === 'largura') return { ...d, padrao: 600 };
      if (d.id === 'altura') return { ...d, padrao: 700 };
      if (d.id === 'profundidade') return { ...d, padrao: 350 };
      if (d.id === 'prateleiras') return { ...d, padrao: 1 };
      if (d.id === 'portas') return { ...d, padrao: '2', opcoes: [{ valor: '0', label: 'Sem' }, { valor: '1', label: '1 porta' }, { valor: '2', label: '2 portas' }] };
      if (d.id === 'puxador') return { ...d, padrao: true };
      return d;
    }),
    { id: 'rodape', label: 'Rodapé', tipo: 'numero', padrao: 0, unidade: 'mm', min: 0, max: 200, passo: 10, dica: '0 = sem rodapé.', mostrarSe: (p) => str(p, 'montagem') !== 'tampo_sobre' },
  ],
  validar: validarArmario,
  gerar: (p, ctx) => gerarArmario({ ...p, espelho: 'sem', nicho: false }, ctx),
};
