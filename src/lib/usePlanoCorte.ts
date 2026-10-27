import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chapa, Peca } from '../domain/types';
import { planejarCorte, type PlanoCorte } from '../optimizer';

let worker: Worker | null = null;
let seq = 0;
const pendentes = new Map<number, (p: PlanoCorte) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../optimizer/worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<{ id: number; plano: PlanoCorte }>) => {
      pendentes.get(ev.data.id)?.(ev.data.plano);
      pendentes.delete(ev.data.id);
    };
  } catch {
    worker = null;
  }
  return worker;
}

const VAZIO: PlanoCorte = { grupos: [], semChapa: [] };

/** Roda o otimizador num Web Worker, com debounce. */
export function usePlanoCorte(pecas: Peca[], lote: number, chapas: Chapa[], kerf: number, refilo: number, tempoMs = 1200) {
  const [plano, setPlano] = useState<PlanoCorte>(VAZIO);
  const [calculando, setCalculando] = useState(false);
  const ultimo = useRef(0);

  // chave estável: só o que importa para o corte
  const chave = useMemo(
    () =>
      JSON.stringify({
        p: pecas.filter((p) => !p.somente3d).map((p) => [p.id, p.nome, p.chapaId, p.comprimento, p.largura, p.quantidade, p.podeGirar]),
        lote,
        c: chapas.map((c) => [c.id, c.largura, c.altura, c.temVeio, c.nome]),
        kerf,
        refilo,
      }),
    [pecas, lote, chapas, kerf, refilo],
  );

  useEffect(() => {
    setCalculando(true);
    const t = setTimeout(() => {
      const id = ++seq;
      ultimo.current = id;
      const w = getWorker();
      const aplicar = (p: PlanoCorte) => {
        if (ultimo.current !== id) return;
        setPlano(p);
        setCalculando(false);
      };
      if (w) {
        pendentes.set(id, aplicar);
        w.postMessage({ id, pecas, lote, chapas, kerf, refilo, tempoMs });
      } else {
        aplicar(planejarCorte(pecas, lote, chapas, { kerf, refilo, tempoMs: 300 }));
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return { plano, calculando };
}
