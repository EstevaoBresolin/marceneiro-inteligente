import { useEffect, useRef, useState } from 'react';
import { PADROES, padraoPorId } from '../domain/padroes';
import type { Chapa } from '../domain/types';
import { AmostraChapa } from './AmostraChapa';
import { cx } from './ui';

/** escolhe a cor/padrão da chapa no 3D: lisos, madeiras ou uma cor qualquer */
export function SeletorPadrao({ chapa, onChange }: { chapa: Chapa; onChange: (padrao: string | undefined, cor: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false);
    addEventListener('mousedown', fora);
    return () => removeEventListener('mousedown', fora);
  }, [aberto]);
  const atual = padraoPorId(chapa.padrao);
  return (
    <div className="relative" ref={caixa}>
      <button aria-label={`Cor no 3D: ${atual?.nome ?? 'cor personalizada'}`} title={atual?.nome ?? 'Cor personalizada'} onClick={() => setAberto(!aberto)} className="flex items-center gap-1.5 rounded border border-linha bg-painel p-0.5 pr-2 text-[12px] hover:border-aco">
        <AmostraChapa chapa={chapa} />
        <span className="max-w-24 truncate">{atual?.nome ?? 'Personalizada'}</span>
      </button>
      {aberto && (
        <div className="absolute right-0 top-10 z-30 w-72 rounded-lg border border-linha bg-painel p-3 shadow-lg">
          {(['liso', 'madeira', 'textura'] as const).map((tipo) => (
            <div key={tipo} className="mb-2">
              <div className="mb-1 text-[11px] text-tinta-3">{tipo === 'liso' ? 'Cores' : tipo === 'madeira' ? 'Madeiras' : 'Texturas'}</div>
              <div className="flex flex-wrap gap-1.5">
                {PADROES.filter((p) => p.tipo === tipo).map((p) => (
                  <button
                    key={p.id}
                    title={p.nome}
                    aria-label={p.nome}
                    aria-pressed={chapa.padrao === p.id}
                    onClick={() => {
                      onChange(p.id, p.base);
                      setAberto(false);
                    }}
                    className={cx('rounded p-0.5', chapa.padrao === p.id ? 'ring-2 ring-aco' : 'hover:ring-1 hover:ring-tinta-3')}
                  >
                    <AmostraChapa padraoId={p.id} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label className="mt-2 flex items-center gap-2 border-t border-linha pt-2 text-[12px] text-tinta-2">
            <input type="color" className="h-7 w-10 cursor-pointer rounded border border-linha" value={chapa.cor} onChange={(e) => onChange(undefined, e.target.value)} />
            Outra cor
          </label>
          <p className="mt-2 text-[11px] text-tinta-3">Aproximação para mostrar ao cliente. A cor real é a da chapa do fornecedor.</p>
        </div>
      )}
    </div>
  );
}
