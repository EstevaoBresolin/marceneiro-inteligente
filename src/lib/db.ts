import Dexie, { type Table } from 'dexie';
import type { Catalogo, Config, Projeto } from '../domain/types';

/**
 * Persistência local (IndexedDB). As tabelas espelham o que será o Supabase:
 * `projetos` ↔ tabela projetos (user_id/empresa_id + jsonb), `kv` ↔ catalogo/config por empresa.
 */
class Banco extends Dexie {
  projetos!: Table<Projeto, string>;
  kv!: Table<{ chave: string; valor: unknown }, string>;
  constructor() {
    super('marceneiro-inteligente');
    this.version(1).stores({ projetos: 'id, atualizadoEm', kv: 'chave' });
  }
}

export const db = new Banco();

export async function lerKv<T>(chave: string): Promise<T | undefined> {
  return (await db.kv.get(chave))?.valor as T | undefined;
}
export const gravarKv = (chave: string, valor: unknown) => db.kv.put({ chave, valor });

export type Estado = { catalogo?: Catalogo; config?: Config };
