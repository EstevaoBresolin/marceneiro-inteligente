import { create } from 'zustand';
import type { Empresa } from '../domain/types';
import { supabase, useNuvem } from './nuvem';

/** Linha da marcenaria na tabela contas: período de teste e plano */
export type Conta = { user_id: string; email: string | null; marcenaria: string | null; cnpj: string | null; criado_em: string; teste_ate: string; plano: 'teste' | 'pago' | 'cortesia' };

type Estado = { conta: Conta | null; equipe: boolean; carregada: boolean };
export const useConta = create<Estado>(() => ({ conta: null, equipe: false, carregada: false }));

export const DIAS_TESTE = 45;
const DIA = 86_400_000;

/** dias que faltam, arredondando para cima (1 = último dia; 0 ou menos = acabou) */
export function diasRestantes(c: Pick<Conta, 'teste_ate'>, agora = Date.now()) {
  return Math.ceil((Date.parse(c.teste_ate) - agora) / DIA);
}
export const textoDias = (n: number) => (n > 1 ? `faltam ${n} dias` : n === 1 ? 'último dia' : 'terminou');
export const testeAcabou = (c: Conta | null) => !!c && c.plano === 'teste' && Date.parse(c.teste_ate) <= Date.now();

export async function carregarConta() {
  if (!supabase || !useNuvem.getState().sessao) return;
  try {
    const [{ data }, { data: eq }] = await Promise.all([supabase.from('contas').select('user_id,email,marcenaria,cnpj,criado_em,teste_ate,plano').maybeSingle(), supabase.rpc('eh_equipe')]);
    useConta.setState({ conta: (data as Conta) ?? null, equipe: eq === true, carregada: true });
  } catch {
    useConta.setState({ carregada: true });
  }
}

let ultimo = '';
let timer: ReturnType<typeof setTimeout> | null = null;
/** manda nome, CNPJ e contato da marcenaria para o painel da equipe (e marca o último acesso) */
export function enviarDadosEmpresa(e: Empresa, ja = false) {
  if (!supabase || !useNuvem.getState().sessao) return;
  const args = { marcenaria: e.nome, cnpj: e.documento, responsavel: e.responsavel, telefone: e.telefone, cidade: e.cidade };
  const chave = JSON.stringify(args);
  if (chave === ultimo && !ja) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(
    async () => {
      const { data, error } = await supabase!.rpc('atualizar_minha_conta', args);
      if (!error) {
        ultimo = chave;
        if (data) useConta.setState((s) => ({ conta: s.conta ? { ...s.conta, marcenaria: data.marcenaria, cnpj: data.cnpj } : (data as Conta) }));
      }
    },
    ja ? 0 : 3000,
  );
}
