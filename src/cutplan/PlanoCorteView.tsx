import { AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { fmtNum } from '../domain/money';
import type { FitaBorda, Peca } from '../domain/types';
import type { PlanoCorte } from '../optimizer';
import { chaveLegenda, DiagramaChapa, legendaDoGrupo } from './DiagramaChapa';

export function textoBordas(p: Peca, fitas: FitaBorda[]) {
  const lados = [
    p.bordas.c1 && 'C',
    p.bordas.c2 && 'C',
    p.bordas.l1 && 'L',
    p.bordas.l2 && 'L',
  ].filter(Boolean) as string[];
  if (!lados.length) return 'sem fita';
  const c = lados.filter((l) => l === 'C').length;
  const l = lados.filter((x) => x === 'L').length;
  const fita = fitas.find((f) => f.id === (p.bordas.c1 ?? p.bordas.c2 ?? p.bordas.l1 ?? p.bordas.l2));
  return `${[c && `${c}C`, l && `${l}L`].filter(Boolean).join(' + ')}${fita ? ` · ${fita.nome.replace(/^Fita\s+/i, '')}` : ''}`;
}

function Numero({ valor, label }: { valor: string; label: string }) {
  return (
    <div>
      <div className="font-cond text-2xl font-semibold num leading-none">{valor}</div>
      <div className="text-xs text-tinta-3 mt-1">{label}</div>
    </div>
  );
}

export function PlanoCorteView({ plano, pecas, fitas, calculando }: { plano: PlanoCorte; pecas: Peca[]; fitas: FitaBorda[]; calculando: boolean }) {
  const [verCortes, setVerCortes] = useState<string | null>(null);
  const totalChapas = plano.grupos.reduce((s, g) => s + g.chapas.length, 0);

  if (!plano.grupos.length && !calculando)
    return <p className="p-6 text-tinta-2">Adicione peças para ver o plano de corte.</p>;

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <Numero valor={String(totalChapas)} label={totalChapas === 1 ? 'chapa' : 'chapas'} />
        <Numero valor={String(plano.grupos.reduce((s, g) => s + g.totalPecas, 0))} label="peças" />
        <Numero
          valor={`${fmtNum(
            (plano.grupos.reduce((s, g) => s + g.aproveitamentoMedio * g.chapas.length, 0) / Math.max(1, totalChapas)) * 100,
            0,
          )}%`}
          label="aproveitamento médio"
        />
        <Numero valor={`${fmtNum(plano.grupos.reduce((s, g) => s + g.metrosCorte, 0), 1)} m`} label="de corte" />
        {calculando && (
          <span className="flex items-center gap-1.5 text-[13px] text-tinta-3">
            <Loader2 className="size-4 animate-spin" /> otimizando…
          </span>
        )}
      </div>

      {plano.grupos.flatMap((g) =>
        g.naoCabem.length
          ? [
              <div key={`nc-${g.chapa.id}`} className="flex gap-2 rounded-md border border-perigo/30 bg-[#fbeeeb] p-3 text-[13px] text-perigo">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>
                  {g.naoCabem.length} peça(s) maiores que a chapa {g.chapa.nome} ({g.chapa.largura}×{g.chapa.altura} menos refilo):{' '}
                  {[...new Set(g.naoCabem.map((p) => `${p.rotulo} ${p.w}×${p.h}`))].join(', ')}. Divida a peça ou use outra chapa.
                </span>
              </div>,
            ]
          : [],
      )}

      {plano.grupos.map((g) => {
        const legenda = legendaDoGrupo(g);
        return (
          <section key={g.chapa.id} className={calculando ? 'opacity-60 transition-opacity' : ''}>
            <h3 className="font-cond text-lg font-semibold">
              {g.chapa.nome} <span className="font-sans text-[13px] font-normal text-tinta-3">· {g.chapa.largura}×{g.chapa.altura} mm · {g.chapas.length} chapa(s)</span>
            </h3>

            <ol className="mt-2 mb-3 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2 xl:grid-cols-3">
              {[...legenda.entries()].map(([chave, { numero, cor, pecaId: pid }]) => {
                const peca = pecas.find((p) => p.id === pid);
                const qtd = g.chapas.reduce((s, c) => s + c.pecas.filter((p) => chaveLegenda(p) === chave).length, 0);
                const exemplo = g.chapas.flatMap((c) => c.pecas).find((p) => chaveLegenda(p) === chave)!;
                const c = exemplo.rotacionada ? exemplo.h : exemplo.w;
                const l = exemplo.rotacionada ? exemplo.w : exemplo.h;
                return (
                  <li key={chave} className="flex items-center gap-2">
                    <span className="inline-flex size-5 items-center justify-center rounded-sm font-cond text-xs font-bold" style={{ background: cor }}>
                      {numero}
                    </span>
                    <span className="truncate">
                      {exemplo.rotulo} <span className="num text-tinta-2">{c}×{l}</span> <span className="text-tinta-3">×{qtd}{peca ? ` · ${textoBordas(peca, fitas)}` : ''}</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="grid gap-4 lg:grid-cols-2">
              {g.chapas.map((ch) => {
                const chave = `${g.chapa.id}-${ch.indice}`;
                return (
                  <figure key={ch.indice} className="rounded-lg border border-linha bg-painel p-3">
                    <figcaption className="mb-2 flex items-baseline justify-between text-[13px]">
                      <span className="font-medium">Chapa {ch.indice + 1}</span>
                      <span className="text-tinta-3 num">
                        {ch.pecas.length} peças · {fmtNum(ch.aproveitamento * 100, 0)}% · {fmtNum(ch.metrosCorte, 1)} m de corte
                      </span>
                    </figcaption>
                    <DiagramaChapa grupo={g} chapa={ch} legenda={legenda} className="w-full h-auto" />
                    <button className="mt-2 text-[13px] text-aco hover:underline" onClick={() => setVerCortes(verCortes === chave ? null : chave)}>
                      {verCortes === chave ? 'Esconder sequência de cortes' : `Ver sequência de cortes (${ch.cortes.length})`}
                    </button>
                    {verCortes === chave && (
                      <ol className="mt-2 max-h-56 overflow-auto rounded border border-linha text-[12px] num">
                        {ch.cortes.map((c) => (
                          <li key={c.ordem} className="flex gap-3 border-b border-linha px-2 py-1 last:border-0">
                            <span className="w-6 text-tinta-3">{c.ordem}</span>
                            <span className="w-20">{c.direcao === 'horizontal' ? '↔ horizontal' : '↕ vertical'}</span>
                            <span className="text-tinta-2">
                              {c.direcao === 'horizontal' ? `y = ${c.y}` : `x = ${c.x}`} · {c.comprimento} mm
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {ch.sobras.length > 0 && (
                      <p className="mt-1 text-[12px] text-tinta-3">
                        Sobras reaproveitáveis: {ch.sobras.slice(0, 4).map((s) => `${s.w}×${s.h}`).join(', ')}
                        {ch.sobras.length > 4 ? '…' : ''}
                      </p>
                    )}
                  </figure>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
