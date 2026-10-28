import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chapa, Peca } from '../domain/types';
import { planejarCorte, type PlanoCorte } from '../optimizer';

let worker: Worker | null = null;
let seq = 0;
const pendentes = new Map<number, (p: PlanoCorte[]) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../optimizer/worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<{ id: number; planos: PlanoCorte[] }>) => {
      pendentes.get(ev.data.id)?.(ev.data.planos);
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
        c: chapas.map((c) => [c.id, c.largura, c.altura, c.temVeio, c.nome, c.precoCentavos, c.tamanhos ?? []]),
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
      const aplicar = (p: PlanoCorte[]) => {
        if (ultimo.current !== id) return;
        setPlano(p[0]);
        setCalculando(false);
      };
      if (w) {
        pendentes.set(id, aplicar);
        w.postMessage({ id, pedidos: [{ pecas, lote }], chapas, kerf, refilo, tempoMs });
      } else {
        aplicar([planejarCorte(pecas, lote, chapas, { kerf, refilo, tempoMs: 300 })]);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return { plano, calculando };
}

/** Vários planos de uma vez no worker (ex.: comparar projetos separados com tudo junto). */
export function usePlanosCorte(pedidos: { pecas: Peca[]; lote: number }[], chapas: Chapa[], kerf: number, refilo: number, tempoMs = 2500) {
  const [planos, setPlanos] = useState<PlanoCorte[]>([]);
  const [calculando, setCalculando] = useState(false);
  const ultimo = useRef(0);
  const chave = useMemo(
    () =>
      JSON.stringify({
        p: pedidos.map((x) => [x.lote, x.pecas.filter((p) => !p.somente3d).map((p) => [p.id, p.chapaId, p.comprimento, p.largura, p.quantidade, p.podeGirar])]),
        c: chapas.map((c) => [c.id, c.largura, c.altura, c.temVeio, c.precoCentavos, c.tamanhos ?? []]),
        kerf,
        refilo,
      }),
    [pedidos, chapas, kerf, refilo],
  );
  useEffect(() => {
    if (!pedidos.length) {
      setPlanos([]);
      setCalculando(false);
      return;
    }
    setCalculando(true);
    const t = setTimeout(() => {
      const id = ++seq;
      ultimo.current = id;
      const aplicar = (p: PlanoCorte[]) => {
        if (ultimo.current !== id) return;
        setPlanos(p);
        setCalculando(false);
      };
      const w = getWorker();
      if (w) {
        pendentes.set(id, aplicar);
        w.postMessage({ id, pedidos, chapas, kerf, refilo, tempoMs });
      } else aplicar(pedidos.map((x) => planejarCorte(x.pecas, x.lote, chapas, { kerf, refilo, tempoMs: 200 })));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return { planos, calculando };
}
