import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'fantasma' | 'perigo'; tamanho?: 'sm' | 'md' };

export function Botao({ variante = 'secundario', tamanho = 'md', className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap',
        tamanho === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-9 px-3.5',
        variante === 'primario' && 'bg-aco text-white hover:bg-[#244b65]',
        variante === 'secundario' && 'bg-painel border border-linha text-tinta hover:bg-painel-2',
        variante === 'fantasma' && 'text-tinta-2 hover:bg-painel-2 hover:text-tinta',
        variante === 'perigo' && 'text-perigo hover:bg-[#f7e6e3]',
        className,
      )}
    />
  );
}

export function Campo({ label, dica, children, unidade }: { label: string; dica?: string; children: ReactNode; unidade?: string }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[13px] text-tinta-2 mb-1">
        <span>{label}</span>
        {unidade && <span className="text-tinta-3 text-xs">{unidade}</span>}
      </span>
      {children}
      {dica && <span className="block text-xs text-tinta-3 mt-1">{dica}</span>}
    </label>
  );
}

const inputBase =
  'w-full h-9 rounded-md border border-linha bg-painel px-2.5 text-tinta outline-none focus:border-aco focus:ring-2 focus:ring-aco-claro';

/** Campo numérico que aceita vírgula e só confirma valores válidos */
export function NumeroInput({
  valor,
  onChange,
  min,
  max,
  passo,
  className,
  ariaLabel,
}: {
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  passo?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [texto, setTexto] = useState(String(valor).replace('.', ','));
  useEffect(() => {
    const atual = Number(texto.replace(',', '.'));
    if (atual !== valor) setTexto(String(valor).replace('.', ','));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return (
    <input
      aria-label={ariaLabel}
      inputMode="decimal"
      className={cx(inputBase, 'num text-right', className)}
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = Number(e.target.value.replace(',', '.'));
        if (e.target.value.trim() !== '' && Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) onChange(n);
      }}
      onBlur={() => setTexto(String(valor).replace('.', ','))}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const d = (passo ?? 1) * (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
          let n = Math.round((valor + d) * 100) / 100;
          if (min !== undefined) n = Math.max(min, n);
          if (max !== undefined) n = Math.min(max, n);
          onChange(n);
        }
      }}
    />
  );
}

/** Valor em R$ editado como reais, guardado em centavos */
export function DinheiroInput({ centavos, onChange, ariaLabel }: { centavos: number; onChange: (c: number) => void; ariaLabel?: string }) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tinta-3 text-[13px]">R$</span>
      <NumeroInput ariaLabel={ariaLabel} className="pl-8" valor={centavos / 100} min={0} passo={1} onChange={(v) => onChange(Math.round(v * 100))} />
    </div>
  );
}

export function TextoInput({ valor, onChange, className, placeholder, ariaLabel }: { valor: string; onChange: (v: string) => void; className?: string; placeholder?: string; ariaLabel?: string }) {
  return <input aria-label={ariaLabel} className={cx(inputBase, className)} value={valor} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Selecao({ valor, onChange, opcoes, className, ariaLabel }: { valor: string; onChange: (v: string) => void; opcoes: { valor: string; label: string }[]; className?: string; ariaLabel?: string }) {
  return (
    <select aria-label={ariaLabel} className={cx(inputBase, 'pr-7', className)} value={valor} onChange={(e) => onChange(e.target.value)}>
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Botões lado a lado para poucas opções */
export function Segmentos({ valor, onChange, opcoes }: { valor: string; onChange: (v: string) => void; opcoes: { valor: string; label: string }[] }) {
  return (
    <div className="flex rounded-md border border-linha bg-painel-2 p-0.5" role="radiogroup">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cx('flex-1 h-8 rounded text-[13px] transition-colors', valor === o.valor ? 'bg-painel text-tinta shadow-[0_0_0_1px_var(--color-linha)] font-medium' : 'text-tinta-2 hover:text-tinta')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Interruptor({ ligado, onChange, label }: { ligado: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={ligado} onClick={() => onChange(!ligado)} className="flex w-full items-center justify-between gap-3 py-1 text-left">
      <span className="text-[13px] text-tinta-2">{label}</span>
      <span className={cx('relative h-5 w-9 rounded-full transition-colors', ligado ? 'bg-aco' : 'bg-linha')}>
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', ligado ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  );
}

export function Abas<T extends string>({ valor, onChange, abas }: { valor: T; onChange: (v: T) => void; abas: { id: T; label: ReactNode }[] }) {
  return (
    <div className="flex gap-1 border-b border-linha px-3" role="tablist">
      {abas.map((a) => (
        <button
          key={a.id}
          role="tab"
          aria-selected={valor === a.id}
          onClick={() => onChange(a.id)}
          className={cx('relative h-10 px-3 text-[13px] font-medium transition-colors', valor === a.id ? 'text-tinta' : 'text-tinta-3 hover:text-tinta-2')}
        >
          {a.label}
          {valor === a.id && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-mdf" />}
        </button>
      ))}
    </div>
  );
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="font-cond text-2xl font-semibold tracking-tight">{children}</h1>
      {sub && <p className="text-tinta-2 mt-1">{sub}</p>}
    </div>
  );
}

export function Painel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-lg border border-linha bg-painel', className)}>{children}</section>;
}
