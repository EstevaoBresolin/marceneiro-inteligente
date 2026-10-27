import type { Chapa, FitaBorda, Peca } from '../domain/types';
import type { Furo } from '../domain/usinagem';
import { geometriaDesenho } from './desenho';

type Props = { peca: Peca; numero: string; quantidade: number; furos: Furo[]; chapa?: Chapa; fitas: FitaBorda[] };

export function DesenhoPeca({ peca, numero, quantidade, furos, chapa, fitas }: Props) {
  const g = geometriaDesenho(peca, furos);
  const { C, W } = g;
  const M = Math.max(C, W);
  const fs = M * 0.04; // tamanho de texto proporcional ao desenho
  const mg = M * 0.14;
  const vb = `${-mg} ${-mg * 0.6} ${C + mg * 1.6} ${W + mg * 1.9}`;
  const Y = (y: number) => W - y; // C1 embaixo
  const fitaNome = fitas.find((f) => f.id === (peca.bordas.c1 ?? peca.bordas.c2 ?? peca.bordas.l1 ?? peca.bordas.l2))?.nome;

  const linhaFita = (b: string) => {
    const off = fs * 0.35;
    const esq = (b === 'l1') !== g.espelhado;
    if (b === 'c1') return { x1: 0, y1: W + off, x2: C, y2: W + off };
    if (b === 'c2') return { x1: 0, y1: -off, x2: C, y2: -off };
    return esq ? { x1: -off, y1: 0, x2: -off, y2: W } : { x1: C + off, y1: 0, x2: C + off, y2: W };
  };
  const rotuloBorda = (b: string) => {
    const esq = (b === 'l1') !== g.espelhado;
    if (b === 'c1') return { x: C / 2, y: W + fs * 1.6 };
    if (b === 'c2') return { x: C / 2, y: -fs * 0.9 };
    return { x: esq ? -fs * 1.4 : C + fs * 1.4, y: W / 2 };
  };

  return (
    <figure className="rounded-lg border border-linha bg-painel p-3">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2">
        <span>
          <span className="mr-1.5 rounded bg-tinta px-1.5 py-0.5 font-cond text-[12px] font-bold text-white">{numero}</span>
          <span className="font-cond text-[15px] font-semibold">{peca.nome}</span>
          {quantidade > 1 && <span className="ml-1 text-[13px] text-tinta-3">×{quantidade}</span>}
        </span>
        <span className="text-[12px] text-tinta-3 num">
          {C} × {W} × {chapa?.espessura ?? '?'} mm
        </span>
      </figcaption>
      <svg viewBox={vb} className="h-auto w-full" role="img" aria-label={`Desenho de ${peca.nome}`}>
        <defs>
          <pattern id={`hach-${numero}`} width={fs * 0.6} height={fs * 0.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2={fs * 0.6} stroke="#e7dccb" strokeWidth={fs * 0.12} />
          </pattern>
        </defs>
        <rect x={0} y={0} width={C} height={W} fill="#fbf7f0" stroke="#5b4a39" strokeWidth={fs * 0.08} />

        {g.fitas.map((b) => (
          <line key={b} {...linhaFita(b)} stroke="#b5895a" strokeWidth={fs * 0.4} strokeLinecap="round" />
        ))}
        {(['c1', 'c2', 'l1', 'l2'] as const).map((b) => {
          const r = rotuloBorda(b);
          return (
            <text key={b} x={r.x} y={r.y} fontSize={fs * 0.75} textAnchor="middle" dominantBaseline="middle" fill={g.fitas.includes(b) ? '#7e5a36' : '#8b959a'} fontFamily="IBM Plex Sans Condensed, sans-serif" fontWeight={600}>
              {b.toUpperCase()}
            </text>
          );
        })}

        {g.topos.map((t, i) => (
          <rect key={`t${i}`} x={t.x} y={Y(t.y + t.h)} width={t.w} height={t.h} fill={`url(#hach-${numero})`} stroke={t.cor} strokeWidth={fs * 0.07} strokeDasharray={`${fs * 0.25} ${fs * 0.15}`} />
        ))}
        {g.furos.map((f, i) => (
          <g key={`f${i}`}>
            <circle cx={f.x} cy={Y(f.y)} r={Math.max(f.r, fs * 0.16)} fill={f.faceVisivel ? '#ffffff' : 'none'} stroke={f.cor} strokeWidth={fs * 0.09} strokeDasharray={f.faceVisivel ? undefined : `${fs * 0.2} ${fs * 0.14}`} />
            <circle cx={f.x} cy={Y(f.y)} r={fs * 0.06} fill={f.cor} />
          </g>
        ))}

        {/* cotas gerais */}
        <g stroke="#59646a" strokeWidth={fs * 0.05} fill="#22282b" fontSize={fs} fontFamily="IBM Plex Sans Condensed, sans-serif">
          <line x1={0} y1={W + fs * 3} x2={C} y2={W + fs * 3} />
          <line x1={0} y1={W + fs * 2.4} x2={0} y2={W + fs * 3.6} />
          <line x1={C} y1={W + fs * 2.4} x2={C} y2={W + fs * 3.6} />
          <text x={C / 2} y={W + fs * 4.6} textAnchor="middle" stroke="none" fontWeight={600}>
            {C}
          </text>
          <line x1={-fs * 3} y1={0} x2={-fs * 3} y2={W} />
          <line x1={-fs * 3.6} y1={0} x2={-fs * 2.4} y2={0} />
          <line x1={-fs * 3.6} y1={W} x2={-fs * 2.4} y2={W} />
          <text x={-fs * 3.9} y={W / 2} textAnchor="middle" stroke="none" fontWeight={600} transform={`rotate(-90 ${-fs * 3.9} ${W / 2})`}>
            {W}
          </text>
        </g>
      </svg>

      <div className="mt-1 text-[12px] text-tinta-3">
        {chapa?.nome}
        {g.fitas.length ? ` · fita em ${g.fitas.map((b) => b.toUpperCase()).join(', ')}${fitaNome ? ` (${fitaNome})` : ''}` : ' · sem fita'}
        {g.espelhado && ' · vista pela face de trás'}
      </div>
      {g.tabela.length > 0 ? (
        <table className="mt-2 w-full text-[12px] num">
          <tbody>
            {g.tabela.map((l, i) => (
              <tr key={i} className="border-t border-linha align-top">
                <td className="py-1 pr-2">
                  <span className="mr-1 inline-block size-2 rounded-full" style={{ background: l.cor }} />
                  {l.qtd}× {l.tipo}
                </td>
                <td className="py-1 pr-2 text-tinta-2">{l.onde}</td>
                <td className="py-1 pr-2 text-tinta-2">{l.medida}</td>
                <td className="py-1 text-tinta-3">{l.pos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-[12px] text-tinta-3">Sem furação.</p>
      )}
    </figure>
  );
}
