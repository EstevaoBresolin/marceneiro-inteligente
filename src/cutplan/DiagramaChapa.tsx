import type { ChapaResultado, ResultadoCorte } from '../optimizer';

// tons de madeira/pintura sólidos, distinguíveis entre si e legíveis com texto escuro
export const CORES_PECAS = ['#e6cfa9', '#c9dbe6', '#d9e3c4', '#efd0c4', '#ddd3ea', '#f1e2a8', '#c8e3dc', '#e8c9d6', '#d6d0c3', '#bfd4ee'];

export function legendaDoGrupo(g: ResultadoCorte) {
  const ids: string[] = [];
  for (const c of g.chapas) for (const p of c.pecas) if (!ids.includes(p.pecaId)) ids.push(p.pecaId);
  return new Map(ids.map((id, i) => [id, { numero: i + 1, cor: CORES_PECAS[i % CORES_PECAS.length] }]));
}

export function DiagramaChapa({ grupo, chapa, legenda, className }: { grupo: ResultadoCorte; chapa: ChapaResultado; legenda: Map<string, { numero: number; cor: string }>; className?: string }) {
  const W = grupo.chapa.largura;
  const H = grupo.chapa.altura;
  const r = grupo.refilo;
  const base = Math.min(W, H);
  const id = `hachura-${grupo.chapa.id}-${chapa.indice}`;

  return (
    <svg viewBox={`-20 -20 ${W + 40} ${H + 40}`} className={className} role="img" aria-label={`Chapa ${chapa.indice + 1} de ${grupo.chapa.nome}`}>
      <defs>
        <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="28" height="28" fill="#f4efe7" />
          <line x1="0" y1="0" x2="0" y2="28" stroke="#d4bfa3" strokeWidth="6" />
        </pattern>
      </defs>
      {/* chapa: miolo de MDF aparece na borda */}
      <rect x={0} y={0} width={W} height={H} fill="#fbfaf7" stroke="#b5895a" strokeWidth={8} rx={4} />
      {r > 0 && <rect x={r} y={r} width={W - 2 * r} height={H - 2 * r} fill="none" stroke="#c9b597" strokeWidth={3} strokeDasharray="18 14" />}

      {chapa.sobras.map((s, i) => {
        const fs = Math.max(26, Math.min(70, Math.min(s.w, s.h) / 5));
        const cabe = s.w > fs * 5 && s.h > fs * 1.6;
        return (
          <g key={`s${i}`}>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={`url(#${id})`} stroke="#d4bfa3" strokeWidth={2} />
            {cabe && (
              <text x={s.x + s.w / 2} y={s.y + s.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={fs} fill="#8a6c4b" fontFamily="IBM Plex Sans Condensed, sans-serif" fontWeight={600}>
                sobra {s.w}×{s.h}
              </text>
            )}
          </g>
        );
      })}

      {chapa.pecas.map((p, i) => {
        const leg = legenda.get(p.pecaId);
        const menor = Math.min(p.w, p.h);
        const fsNum = Math.min(base / 14, menor / 2.2);
        const fsMed = Math.min(base / 24, menor / 3.4);
        const mostraMedidas = fsMed >= 40 && p.w > fsMed * 5.5 && p.h > fsNum + fsMed * 1.6;
        const mostraNum = fsNum >= 28;
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        return (
          <g key={i}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={leg?.cor ?? '#e6cfa9'} stroke="#5b4a39" strokeWidth={2.5} />
            {mostraNum && (
              <text x={cx} y={mostraMedidas ? cy - fsMed * 0.55 : cy} textAnchor="middle" dominantBaseline="central" fontSize={fsNum} fontWeight={700} fill="#22282b" fontFamily="IBM Plex Sans Condensed, sans-serif">
                {leg?.numero ?? '?'}
              </text>
            )}
            {mostraMedidas && (
              <text x={cx} y={cy + fsNum * 0.6} textAnchor="middle" dominantBaseline="central" fontSize={fsMed} fill="#3d464a" fontFamily="IBM Plex Sans Condensed, sans-serif" fontWeight={500}>
                {p.rotacionada ? `${p.h}×${p.w} ↻` : `${p.w}×${p.h}`}
              </text>
            )}
          </g>
        );
      })}

      {grupo.chapa.temVeio && (
        <g opacity={0.55}>
          <line x1={W - 380} y1={H + 2} x2={W - 60} y2={H + 2} stroke="#7e5a36" strokeWidth={6} markerEnd="" />
          <text x={W - 400} y={H + 4} textAnchor="end" dominantBaseline="central" fontSize={34} fill="#7e5a36" fontFamily="IBM Plex Sans Condensed, sans-serif">
            veio →
          </text>
        </g>
      )}
    </svg>
  );
}
