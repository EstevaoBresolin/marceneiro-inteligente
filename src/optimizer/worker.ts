/// <reference lib="webworker" />
import { planejarCorte } from './index';
import type { Chapa, Peca } from '../domain/types';

/** um ou vários planos (ex.: cada projeto separado, para comparar com tudo junto) */
export type PedidoWorker = { id: number; pedidos: { pecas: Peca[]; lote: number }[]; chapas: Chapa[]; kerf: number; refilo: number; tempoMs: number };

self.onmessage = (ev: MessageEvent<PedidoWorker>) => {
  const { id, pedidos, chapas, kerf, refilo, tempoMs } = ev.data;
  const cada = Math.max(200, Math.floor(tempoMs / Math.max(1, pedidos.length)));
  const planos = pedidos.map((p) => planejarCorte(p.pecas, p.lote, chapas, { kerf, refilo, tempoMs: pedidos.length > 1 ? cada : tempoMs }));
  (self as unknown as Worker).postMessage({ id, planos });
};
