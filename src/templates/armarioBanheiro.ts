import { brl, fmtNum } from '../domain/money';
import type { Extra, ItemFerragem, Peca } from '../domain/types';
import { bordas, caixa, dobradicasPorPorta, semBorda } from './comum';
import { bool, num, str, type Template } from './types';

const FUNDO_CHAPA: Record<string, string | null> = { hdf3: 'hdf-branco-3', mdf6: 'mdf-cru-6', sem: null };
const ESPESSURA_ESPELHO = 4;

export const armarioBanheiro: Template = {
  id: 'armario-banheiro',
  nome: 'Armário de banheiro com espelho',
  descricao: 'Armarinho suspenso com prateleiras internas e porta com espelho.',
  horasSugeridas: 1.5,
  parametros: [
    { id: 'largura', label: 'Largura', tipo: 'numero', padrao: 500, unidade: 'mm', min: 200, max: 1600, passo: 10 },
    { id: 'altura', label: 'Altura', tipo: 'numero', padrao: 600, unidade: 'mm', min: 250, max: 1800, passo: 10 },
    { id: 'profundidade', label: 'Profundidade', tipo: 'numero', padrao: 150, unidade: 'mm', min: 80, max: 450, passo: 5, dica: 'Profundidade do corpo, sem a porta.' },
    { id: 'chapaId', label: 'Chapa do corpo', tipo: 'chapa', padrao: 'mdf-branco-15' },
    { id: 'prateleiras', label: 'Prateleiras internas', tipo: 'numero', padrao: 2, min: 0, max: 6, passo: 1 },
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
  ],

  validar(p, { catalogo }) {
    const erros: string[] = [];
    const chapa = catalogo.chapas.find((c) => c.id === str(p, 'chapaId'));
    if (!chapa) return ['Escolha uma chapa válida para o corpo.'];
    const e = chapa.espessura;
    const A = num(p, 'altura');
    const L = num(p, 'largura');
    if (L < 2 * e + 100) erros.push('Largura muito pequena para a espessura da chapa.');
    if (bool(p, 'nicho') && num(p, 'alturaNicho') > A - 3 * e - 100) erros.push('O nicho ocupa quase toda a altura — diminua a altura do nicho.');
    const fundo = FUNDO_CHAPA[str(p, 'fundo')];
    if (fundo && !catalogo.chapas.find((c) => c.id === fundo)) erros.push('A chapa do fundo não existe no catálogo.');
    return erros;
  },

  gerar(p, { catalogo, config }) {
    const chapa = catalogo.chapas.find((c) => c.id === str(p, 'chapaId')) ?? catalogo.chapas[0];
    const e = chapa.espessura;
    const L = num(p, 'largura');
    const A = num(p, 'altura');
    const P = num(p, 'profundidade');
    const n = Math.max(0, Math.round(num(p, 'prateleiras')));
    const nPortas = str(p, 'portas') === '2' ? 2 : 1;
    const espelho = str(p, 'espelho');
    const temNicho = bool(p, 'nicho');
    const hn = temNicho ? num(p, 'alturaNicho') : 0;
    const f = num(p, 'folgaPorta');
    const recuo = num(p, 'recuoPrateleira');
    const fita = catalogo.fitas.find((x) => x.id === str(p, 'fitaId'))?.id ?? catalogo.fitas[0]?.id ?? null;
    const montagem = str(p, 'montagem');
    const girar = !chapa.temVeio;

    const fundoChapaId = FUNDO_CHAPA[str(p, 'fundo')] ?? null;
    const fundoChapa = fundoChapaId ? catalogo.chapas.find((c) => c.id === fundoChapaId) : undefined;
    const tF = fundoChapa?.espessura ?? 0;
    const pregado = !!fundoChapa && str(p, 'fixacaoFundo') !== 'embutido';
    const embutido = !!fundoChapa && !pregado;

    // corpo: z de zb (atrás) até P (frente). Fundo pregado fica atrás, dentro da profundidade total.
    const zb = pregado ? tF : 0;
    const Pb = P - zb; // profundidade das laterais/tampo/base
    const x0 = -L / 2;
    const x1 = L / 2;

    const pecas: Peca[] = [];
    const ferragens: ItemFerragem[] = [];
    const extras: Extra[] = [];
    const cavilhasPorJunta = 2;
    const juntasPorLateral = 2 + (temNicho ? 1 : 0);

    // ---------- Laterais, tampo, base ----------
    if (montagem === 'tampo_sobre') {
      const hLat = A - 2 * e;
      pecas.push(
        {
          id: 'lateral',
          nome: 'Lateral',
          papel: 'lateral',
          chapaId: chapa.id,
          comprimento: hLat,
          largura: Pb,
          quantidade: 2,
          podeGirar: girar,
          bordas: bordas(fita, { c1: true }),
          furos: [{ tipo: 'cavilha_8', quantidade: cavilhasPorJunta * juntasPorLateral }],
        },
        {
          id: 'tampo',
          nome: 'Tampo',
          papel: 'tampo',
          chapaId: chapa.id,
          comprimento: L,
          largura: Pb,
          quantidade: 1,
          podeGirar: girar,
          bordas: bordas(fita, { c1: true, l1: true, l2: true }),
          furos: [{ tipo: 'cavilha_8', quantidade: 2 * cavilhasPorJunta }],
          box3d: caixa(x0, x1, A - e, A, zb, P),
        },
        {
          id: 'base',
          nome: 'Base',
          papel: 'base',
          chapaId: chapa.id,
          comprimento: L,
          largura: Pb,
          quantidade: 1,
          podeGirar: girar,
          bordas: bordas(fita, { c1: true, l1: true, l2: true }),
          furos: [{ tipo: 'cavilha_8', quantidade: 2 * cavilhasPorJunta }],
          box3d: caixa(x0, x1, 0, e, zb, P),
        },
      );
    } else {
      pecas.push(
        {
          id: 'lateral',
          nome: 'Lateral',
          papel: 'lateral',
          chapaId: chapa.id,
          comprimento: A,
          largura: Pb,
          quantidade: 2,
          podeGirar: girar,
          bordas: bordas(fita, { c1: true, l1: true, l2: true }),
          furos: [{ tipo: 'cavilha_8', quantidade: cavilhasPorJunta * juntasPorLateral }],
        },
        {
          id: 'tampo',
          nome: 'Tampo',
          papel: 'tampo',
          chapaId: chapa.id,
          comprimento: L - 2 * e,
          largura: Pb,
          quantidade: 1,
          podeGirar: girar,
          bordas: bordas(fita, { c1: true }),
          furos: [{ tipo: 'cavilha_8', quantidade: 2 * cavilhasPorJunta }],
          box3d: caixa(x0 + e, x1 - e, A - e, A, zb, P),
        },
        {
          id: 'base',
          nome: 'Base',
          papel: 'base',
          chapaId: chapa.id,
          comprimento: L - 2 * e,
          largura: Pb,
          quantidade: 1,
          podeGirar: girar,
          bordas: bordas(fita, { c1: true }),
          furos: [{ tipo: 'cavilha_8', quantidade: 2 * cavilhasPorJunta }],
          box3d: caixa(x0 + e, x1 - e, 0, e, zb, P),
        },
      );
    }
    // as duas laterais compartilham a mesma linha (qtd 2) mas precisam de duas caixas 3D
    const yLat0 = montagem === 'tampo_sobre' ? e : 0;
    const yLat1 = montagem === 'tampo_sobre' ? A - e : A;
    const lateral = pecas[0];
    lateral.box3d = caixa(x0, x0 + e, yLat0, yLat1, zb, P);
    const lateralDir: Peca = { ...lateral, id: 'lateral#2', quantidade: 0, somente3d: true, box3d: caixa(x1 - e, x1, yLat0, yLat1, zb, P) };

    // ---------- Divisória do nicho ----------
    let yInterior = e;
    if (temNicho) {
      const yDiv = e + hn;
      pecas.push({
        id: 'divisoria',
        nome: 'Divisória do nicho',
        papel: 'divisoria',
        chapaId: chapa.id,
        comprimento: L - 2 * e,
        largura: Pb,
        quantidade: 1,
        podeGirar: girar,
        bordas: bordas(fita, { c1: true }),
        furos: [{ tipo: 'cavilha_8', quantidade: 2 * cavilhasPorJunta }],
        box3d: caixa(x0 + e, x1 - e, yDiv, yDiv + e, zb, P),
      });
      yInterior = yDiv + e;
    }

    // ---------- Prateleiras (móveis, sobre pinos) ----------
    if (n > 0) {
      const ySup = A - e;
      const Hi = ySup - yInterior;
      const vao = (Hi - n * e) / (n + 1);
      const zIni = zb + (embutido ? tF : 0);
      const profPrat = P - zIni - recuo;
      const largPrat = L - 2 * e - 2; // 1 mm de folga de cada lado
      for (let k = 1; k <= n; k++) {
        const y = yInterior + k * vao + (k - 1) * e;
        const pec: Peca = {
          id: k === 1 ? 'prateleira' : `prateleira#${k}`,
          nome: 'Prateleira',
          papel: 'prateleira',
          chapaId: chapa.id,
          comprimento: largPrat,
          largura: profPrat,
          quantidade: k === 1 ? n : 0,
          podeGirar: girar,
          bordas: bordas(fita, { c1: true }),
          furos: [],
          somente3d: k > 1,
          box3d: caixa(-largPrat / 2, largPrat / 2, y, y + e, zIni, zIni + profPrat),
        };
        pecas.push(pec);
      }
      // 4 furos de pino por prateleira, nas laterais (2 em cada)
      lateral.furos.push({ tipo: 'outro', quantidade: 2 * n });
      ferragens.push({ ferragemId: 'suporte-prateleira', quantidade: 4 * n });
    }

    // ---------- Fundo ----------
    if (fundoChapa) {
      const fundo: Peca = pregado
        ? {
            id: 'fundo',
            nome: 'Fundo',
            papel: 'fundo',
            chapaId: fundoChapa.id,
            comprimento: A - 4,
            largura: L - 4,
            quantidade: 1,
            podeGirar: !fundoChapa.temVeio,
            bordas: { ...semBorda },
            furos: [],
            box3d: caixa(x0 + 2, x1 - 2, 2, A - 2, 0, tF),
          }
        : {
            id: 'fundo',
            nome: 'Fundo',
            papel: 'fundo',
            chapaId: fundoChapa.id,
            comprimento: A - 2 * e,
            largura: L - 2 * e,
            quantidade: 1,
            podeGirar: !fundoChapa.temVeio,
            bordas: { ...semBorda },
            furos: [],
            box3d: caixa(x0 + e, x1 - e, e, A - e, 0, tF),
          };
      pecas.push(fundo);
    }

    // ---------- Portas ----------
    const yPorta0 = (temNicho ? e + hn : 0) + f;
    const yPorta1 = A - f;
    const hPorta = Math.floor(yPorta1 - yPorta0);
    const wPorta = Math.floor(nPortas === 1 ? L - 2 * f : (L - 3 * f) / 2);
    const nDob = dobradicasPorPorta(hPorta);
    const portaDeEspelho = espelho === 'porta_espelho';
    const espPorta = portaDeEspelho ? ESPESSURA_ESPELHO : e;

    const portasX: { xa: number; xb: number; xHinge: number; sinal: 1 | -1 }[] =
      nPortas === 1
        ? [{ xa: x0 + f, xb: x0 + f + wPorta, xHinge: x0 + f, sinal: -1 }]
        : [
            { xa: x0 + f, xb: x0 + f + wPorta, xHinge: x0 + f, sinal: -1 },
            { xa: x1 - f - wPorta, xb: x1 - f, xHinge: x1 - f, sinal: 1 },
          ];

    portasX.forEach((px, i) => {
      const box = caixa(px.xa, px.xb, yPorta0, yPorta0 + hPorta, P, P + espPorta);
      box.dobradica = { x: px.xHinge, z: P, sinal: px.sinal };
      if (portaDeEspelho) {
        pecas.push({
          id: `espelho${i ? '#' + (i + 1) : ''}`,
          nome: 'Porta de espelho',
          papel: 'espelho',
          chapaId: chapa.id,
          comprimento: hPorta,
          largura: wPorta,
          quantidade: 0,
          podeGirar: false,
          bordas: { ...semBorda },
          furos: [],
          somente3d: true,
          box3d: box,
        });
      } else {
        pecas.push({
          id: i === 0 ? 'porta' : `porta#${i + 1}`,
          nome: 'Porta',
          papel: 'porta',
          chapaId: chapa.id,
          comprimento: hPorta,
          largura: wPorta,
          quantidade: i === 0 ? nPortas : 0,
          podeGirar: girar,
          bordas: bordas(fita, { c1: true, c2: true, l1: true, l2: true }),
          furos: [{ tipo: 'dobradica_35', quantidade: nDob }, ...(bool(p, 'puxador') ? [{ tipo: 'puxador' as const, quantidade: 1 }] : [])],
          somente3d: i > 0,
          box3d: box,
        });
        if (espelho === 'colado') {
          const m = 3; // espelho 3 mm menor que a porta em cada lado
          const bx = caixa(px.xa + m, px.xb - m, yPorta0 + m, yPorta0 + hPorta - m, P + e, P + e + ESPESSURA_ESPELHO);
          bx.dobradica = box.dobradica;
          pecas.push({
            id: `espelho${i ? '#' + (i + 1) : ''}`,
            nome: 'Espelho',
            papel: 'espelho',
            chapaId: chapa.id,
            comprimento: hPorta - 2 * m,
            largura: wPorta - 2 * m,
            quantidade: 0,
            podeGirar: false,
            bordas: { ...semBorda },
            furos: [],
            somente3d: true,
            box3d: bx,
          });
        }
      }
    });

    if (portaDeEspelho) {
      ferragens.push({ ferragemId: 'dobradica-vidro', quantidade: nDob * nPortas });
    } else {
      ferragens.push({ ferragemId: 'dobradica-35', quantidade: nDob * nPortas });
      if (bool(p, 'puxador')) ferragens.push({ ferragemId: 'puxador', quantidade: nPortas });
    }

    if (espelho !== 'sem') {
      const m = espelho === 'colado' ? 3 : 0;
      const area = ((wPorta - 2 * m) * (hPorta - 2 * m) * nPortas) / 1e6;
      extras.push({
        descricao: portaDeEspelho ? 'Espelho 4mm (porta, lapidado e furado)' : 'Espelho 4mm (colado na porta)',
        detalhe: `${fmtNum(area, 3)} m² × ${brl(config.servico.espelhoM2Centavos)}/m²`,
        custoCentavos: Math.round(area * config.servico.espelhoM2Centavos),
      });
    }

    ferragens.push({ ferragemId: 'parafuso-4x40', quantidade: pregado ? 16 : 8 });
    ferragens.push({ ferragemId: 'suporte-parede', quantidade: 1 });

    pecas.splice(1, 0, lateralDir);

    return {
      pecas,
      ferragens,
      extras,
      dimensoes: { largura: L, altura: A, profundidade: P + espPorta + (espelho === 'colado' ? ESPESSURA_ESPELHO : 0) },
    };
  },
};
