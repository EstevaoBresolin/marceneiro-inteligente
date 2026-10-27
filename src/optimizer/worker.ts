/// <reference lib="webworker" />
import { planejarCorte } from './index';
import type { Chapa, Peca } from '../domain/types';

export type PedidoWorker = { id: number; pecas: Peca[]; lote: number; chapas: Chapa[]; kerf: number; refilo: number; tempoMs: number };

self.onmessage = (ev: MessageEvent<PedidoWorker>) => {
  const { id, pecas, lote, chapas, kerf, refilo, tempoMs } = ev.data;
  const plano = planejarCorte(pecas, lote, chapas, { kerf, refilo, tempoMs });
  (self as unknown as Worker).postMessage({ id, plano });
};
