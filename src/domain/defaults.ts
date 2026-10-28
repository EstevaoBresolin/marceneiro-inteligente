import type { Catalogo, Config } from './types';

// Valores de EXEMPLO para começar — ajuste em Catálogo e Configurações.
// Chapa padrão 2750 × 1850 mm.
export const CATALOGO_PADRAO: Catalogo = {
  chapas: [
    { id: 'mdf-branco-15', nome: 'MDF Branco TX 15mm', espessura: 15, largura: 2750, altura: 1850, temVeio: false, precoCentavos: 23000, cor: '#f1efe9' },
    { id: 'mdf-branco-18', nome: 'MDF Branco TX 18mm', espessura: 18, largura: 2750, altura: 1850, temVeio: false, precoCentavos: 27000, cor: '#f1efe9' },
    { id: 'mdf-amadeirado-15', nome: 'MDF Amadeirado 15mm', espessura: 15, largura: 2750, altura: 1850, temVeio: true, precoCentavos: 32000, cor: '#c9a27a' },
    { id: 'hdf-branco-3', nome: 'HDF Branco 3mm', espessura: 3, largura: 2750, altura: 1850, temVeio: false, precoCentavos: 6500, cor: '#e8e6e0' },
    { id: 'mdf-cru-6', nome: 'MDF Cru 6mm', espessura: 6, largura: 2750, altura: 1850, temVeio: false, precoCentavos: 9000, cor: '#c8b28f' },
  ],
  fitas: [
    { id: 'fita-branca-22', nome: 'Fita PVC Branca 22mm', largura: 22, precoMetroCentavos: 60 },
    { id: 'fita-amadeirada-22', nome: 'Fita PVC Amadeirada 22mm', largura: 22, precoMetroCentavos: 90 },
  ],
  ferragens: [
    { id: 'dobradica-35', nome: 'Dobradiça 35mm reta c/ amortecedor', unidade: 'un', precoCentavos: 650 },
    { id: 'dobradica-vidro', nome: 'Dobradiça para vidro/espelho', unidade: 'un', precoCentavos: 1500 },
    { id: 'suporte-prateleira', nome: 'Suporte de prateleira (pino)', unidade: 'un', precoCentavos: 15 },
    { id: 'parafuso-4x40', nome: 'Parafuso 4,0 × 40', unidade: 'un', precoCentavos: 8 },
    { id: 'puxador', nome: 'Puxador simples', unidade: 'un', precoCentavos: 800 },
    { id: 'corredica-telescopica', nome: 'Corrediça telescópica (par)', unidade: 'par', precoCentavos: 2500 },
    { id: 'suporte-parede', nome: 'Suporte de parede (par)', unidade: 'par', precoCentavos: 900 },
  ],
};

export const CONFIG_PADRAO: Config = {
  servico: {
    corteModo: 'por_peca',
    cortePrecoCentavos: 150,
    coladeiraPrecoMetroCentavos: 150,
    furoPrecos: { dobradica_35: 150, cavilha_8: 30, minifix: 50, parafuso: 0, puxador: 50, outro: 50 },
    kerf: 4,
    refilo: 10,
    perdaFitaPercent: 10,
    maoDeObraHoraCentavos: 3000,
    chapaCobranca: 'proporcional',
    perdaChapaPercent: 15,
    espelhoM2Centavos: 18000,
  },
  venda: {
    margemDesejadaPercent: 30,
    impostoPercent: 6,
    comissaoPercent: 0,
    taxaCartaoPercent: 0,
    validadeDias: 15,
    prazoEntregaDias: 30,
    formaPagamento: '50% de entrada e 50% na entrega, ou em até 10x no cartão.',
    descontoAVistaPercent: 5,
    observacoes: 'Instalação inclusa. Medidas confirmadas no local antes da produção.',
  },
  empresa: { nome: '', responsavel: '', telefone: '', email: '', documento: '', endereco: '', cidade: '', logo: null },
  padroes: { folgaPorta: 2, recuoPrateleira: 20 },
  onboardingConcluido: false,
  proximoOrcamento: 1,
};
