import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Catalogo } from '../domain/types';
import type { ParamDef, Params, Template } from '../templates';
import { Campo, Interruptor, NumeroInput, Segmentos, Selecao, cx } from './ui';

function Controle({ d, valor, onChange, catalogo }: { d: ParamDef; valor: Params[string]; onChange: (v: Params[string]) => void; catalogo: Catalogo }) {
  switch (d.tipo) {
    case 'numero':
      return (
        <Campo label={d.label} unidade={d.unidade} dica={d.dica}>
          <NumeroInput ariaLabel={d.label} valor={Number(valor)} min={d.min} max={d.max} passo={d.passo} onChange={onChange} />
        </Campo>
      );
    case 'booleano':
      return (
        <div>
          <Interruptor label={d.label} ligado={valor === true} onChange={onChange} />
          {d.dica && <span className="block text-xs text-tinta-3">{d.dica}</span>}
        </div>
      );
    case 'opcoes':
      return (
        <Campo label={d.label} dica={d.dica}>
          {(d.opcoes?.length ?? 0) <= 2 ? (
            <Segmentos valor={String(valor)} onChange={onChange} opcoes={d.opcoes ?? []} />
          ) : (
            <Selecao ariaLabel={d.label} valor={String(valor)} onChange={onChange} opcoes={d.opcoes ?? []} />
          )}
        </Campo>
      );
    case 'chapa':
      return (
        <Campo label={d.label} dica={d.dica}>
          <Selecao ariaLabel={d.label} valor={String(valor)} onChange={onChange} opcoes={catalogo.chapas.map((c) => ({ valor: c.id, label: c.nome }))} />
        </Campo>
      );
    case 'fita':
      return (
        <Campo label={d.label} dica={d.dica}>
          <Selecao ariaLabel={d.label} valor={String(valor)} onChange={onChange} opcoes={catalogo.fitas.map((f) => ({ valor: f.id, label: f.nome }))} />
        </Campo>
      );
  }
}

export function ParamForm({ template, params, onChange, catalogo }: { template: Template; params: Params; onChange: (p: Params) => void; catalogo: Catalogo }) {
  const [avancado, setAvancado] = useState(false);
  const visiveis = template.parametros.filter((d) => !d.mostrarSe || d.mostrarSe(params));
  const basicos = visiveis.filter((d) => !d.avancado);
  const avancados = visiveis.filter((d) => d.avancado);
  const set = (id: string) => (v: Params[string]) => onChange({ ...params, [id]: v });

  // largura/altura/profundidade lado a lado
  const medidas = basicos.filter((d) => ['largura', 'altura', 'profundidade', 'comprimento'].includes(d.id));
  const resto = basicos.filter((d) => !medidas.includes(d));

  return (
    <div className="space-y-4">
      {medidas.length > 0 && (
        <div className={cx('grid gap-2', medidas.length >= 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          {medidas.map((d) => (
            <Campo key={d.id} label={d.label === 'Profundidade' ? 'Profund.' : d.label === 'Comprimento' ? 'Compr.' : d.label}>
              <NumeroInput ariaLabel={`${d.label} em mm`} valor={Number(params[d.id] ?? d.padrao)} min={d.min} max={d.max} passo={d.passo} onChange={set(d.id)} />
            </Campo>
          ))}
          <p className="col-span-full -mt-1 text-xs text-tinta-3">
            Medidas externas em mm{medidas.some((d) => d.dica) ? `. ${medidas.map((d) => d.dica).filter(Boolean).join(' ')}` : ''}
          </p>
        </div>
      )}
      {resto.map((d) => (
        <Controle key={d.id} d={d} valor={params[d.id] ?? d.padrao} onChange={set(d.id)} catalogo={catalogo} />
      ))}
      {avancados.length > 0 && (
        <div className="border-t border-linha pt-3">
          <button className="flex items-center gap-1 text-[13px] font-medium text-tinta-2 hover:text-tinta" onClick={() => setAvancado(!avancado)} aria-expanded={avancado}>
            <ChevronRight className={cx('size-4 transition-transform', avancado && 'rotate-90')} /> Avançado
          </button>
          {avancado && (
            <div className="mt-3 space-y-4">
              {avancados.map((d) => (
                <Controle key={d.id} d={d} valor={params[d.id] ?? d.padrao} onChange={set(d.id)} catalogo={catalogo} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
