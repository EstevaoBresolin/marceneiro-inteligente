import { armarioBanheiro, armarioPortas } from './armarioBanheiro';
import { estante, nicho } from './caixas';
import { gaveteiro } from './gaveteiro';
import { livre, painel, prateleira, suporteMonitor } from './outros';
import type { Categoria, Params, Template } from './types';

export * from './types';

/** Um modelo existente com outras medidas padrão (ex.: rack = estante baixa com 3 colunas) */
function preset(base: Template, o: { id: string; nome: string; descricao: string; padroes: Params; horas?: number; categoria?: Categoria }): Template {
  return {
    ...base,
    id: o.id,
    nome: o.nome,
    descricao: o.descricao,
    categoria: o.categoria ?? base.categoria,
    horasSugeridas: o.horas ?? base.horasSugeridas,
    parametros: base.parametros.map((d) => (d.id in o.padroes ? { ...d, padrao: o.padroes[d.id] } : d)),
  };
}

const aereo = preset(armarioPortas, { id: 'aereo-cozinha', nome: 'Armário aéreo', descricao: 'Aéreo de cozinha ou lavanderia, 2 portas.', padroes: { largura: 800, altura: 700, profundidade: 330, prateleiras: 1, portas: '2' } });
const balcao = preset(armarioPortas, { id: 'balcao', nome: 'Balcão', descricao: 'Balcão baixo com rodapé e 2 portas. Junte um painel por cima como tampo.', padroes: { largura: 800, altura: 820, profundidade: 530, prateleiras: 1, portas: '2', rodape: 100 } });
const rack = preset(estante, { id: 'rack-tv', nome: 'Rack de TV', descricao: 'Baixo, com 3 vãos abertos.', padroes: { largura: 1400, altura: 450, profundidade: 380, colunas: 3, prateleiras: 0, rodape: 0 }, horas: 1.2 });
const sapateira = preset(estante, { id: 'sapateira', nome: 'Sapateira', descricao: 'Uma coluna, várias prateleiras rasas.', padroes: { largura: 600, altura: 1000, profundidade: 320, colunas: 1, prateleiras: 4 }, horas: 1 });
const livreiro = preset(estante, { id: 'livreiro', nome: 'Livreiro alto', descricao: 'Estante alta de 2 colunas.', padroes: { largura: 900, altura: 1800, profundidade: 300, colunas: 2, prateleiras: 4, rodape: 60 } });
const criado = preset(gaveteiro, { id: 'criado-mudo', nome: 'Criado-mudo', descricao: 'Mesa de cabeceira com 2 gavetas.', padroes: { largura: 450, altura: 500, profundidade: 350, gavetas: 2 }, horas: 1.5 });
const comoda = preset(gaveteiro, { id: 'comoda', nome: 'Cômoda', descricao: 'Quatro gavetas largas.', padroes: { largura: 800, altura: 900, profundidade: 450, gavetas: 4, rodape: 80 }, horas: 3 });

/** Para adicionar um móvel novo: crie um arquivo em src/templates/ e registre aqui. */
export const TEMPLATES: Template[] = [
  armarioBanheiro,
  armarioPortas,
  aereo,
  balcao,
  gaveteiro,
  criado,
  comoda,
  nicho,
  estante,
  rack,
  sapateira,
  livreiro,
  prateleira,
  painel,
  suporteMonitor,
  livre,
];

export const CATEGORIAS: Categoria[] = ['Com portas', 'Gavetas', 'Caixas e estantes', 'Peças'];

export const templatePorId = (id: string) => TEMPLATES.find((t) => t.id === id) ?? livre;

/** id da linha na lista de peças (mantido para ids antigos com "#") */
export const idBase = (id: string) => id.split('#')[0];
