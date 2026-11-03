import { padraoPorId } from '../domain/padroes';
import type { Chapa } from '../domain/types';
import { cx } from './ui';

/** quadradinho com a cor ou o desenho da madeira da chapa */
export function AmostraChapa({ chapa, padraoId, className }: { chapa?: Chapa; padraoId?: string; className?: string }) {
  const p = padraoPorId(padraoId ?? chapa?.padrao);
  const base = p?.base ?? chapa?.cor ?? '#eee';
  const fundo =
    p?.tipo === 'madeira'
      ? `repeating-linear-gradient(100deg, ${p.base} 0 3px, ${p.veio} 3px 4px, ${p.base} 4px 7px, ${p.veio}55 7px 9px)`
      : p?.tipo === 'textura'
        ? `radial-gradient(circle at 30% 40%, ${p.veio} 0 2px, transparent 3px), radial-gradient(circle at 70% 70%, ${p.veio} 0 1.5px, transparent 2.5px), ${p.base}`
        : base;
  return <span aria-hidden className={cx('inline-block size-7 shrink-0 rounded border border-black/15', className)} style={{ background: fundo }} />;
}
