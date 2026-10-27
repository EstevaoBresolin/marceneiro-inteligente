import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { type Lado, type ModuloMontado, templatesDeModulo } from '../domain/composicao';
import type { Catalogo, Modulo } from '../domain/types';
import { CATEGORIAS, templatePorId } from '../templates';
import { ParamForm } from './ParamForm';
import { Botao, Campo, NumeroInput, Selecao, TextoInput, cx } from './ui';

const LADOS: { lado: Lado; label: string; icone: React.ReactNode }[] = [
  { lado: 'esquerda', label: 'À esquerda', icone: <ArrowLeft className="size-4" /> },
  { lado: 'direita', label: 'À direita', icone: <ArrowRight className="size-4" /> },
  { lado: 'cima', label: 'Em cima', icone: <ArrowUp className="size-4" /> },
  { lado: 'baixo', label: 'Embaixo', icone: <ArrowDown className="size-4" /> },
];

/** silhueta frontal mínima do módulo, para a lista */
function Icone({ m }: { m: ModuloMontado }) {
  const w = m.limitesLocais.max[0] - m.limitesLocais.min[0];
  const h = m.limitesLocais.max[1] - m.limitesLocais.min[1];
  const k = 22 / Math.max(w, h, 1);
  return (
    <svg viewBox="0 0 26 26" className="size-6 shrink-0" aria-hidden>
      <rect x={13 - (w * k) / 2} y={13 - (h * k) / 2} width={Math.max(2, w * k)} height={Math.max(2, h * k)} rx={1} fill="#e9d8c3" stroke="#7e5a36" strokeWidth={1.2} />
    </svg>
  );
}

type Props = {
  montados: ModuloMontado[];
  selecionado: string | null;
  onSelecionar: (id: string) => void;
  onAlterar: (id: string, fn: (m: Modulo) => Modulo) => void;
  onTrocarTipo: (id: string, templateId: string) => void;
  onAdicionar: (templateId: string, lado: Lado) => void;
  onDuplicar: (id: string) => void;
  onRemover: (id: string) => void;
  onRestaurar: (id: string) => void;
  catalogo: Catalogo;
};

export function PainelModulos({ montados, selecionado, onSelecionar, onAlterar, onTrocarTipo, onAdicionar, onDuplicar, onRemover, onRestaurar, catalogo }: Props) {
  const [adicionando, setAdicionando] = useState(false);
  const [tipoNovo, setTipoNovo] = useState('nicho');
  const [posicao, setPosicao] = useState(false);
  const atual = montados.find((m) => m.modulo.id === selecionado) ?? montados[0];
  const varios = montados.length > 1;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[13px] text-tinta-2">Módulos</span>
          <span className="text-xs text-tinta-3">{varios ? 'clique para editar' : ''}</span>
        </div>
        <ul className="overflow-hidden rounded-md border border-linha">
          {montados.map((m) => {
            const l = m.limitesLocais;
            const ativo = m.modulo.id === atual?.modulo.id;
            return (
              <li key={m.modulo.id}>
                <button
                  onClick={() => onSelecionar(m.modulo.id)}
                  aria-current={ativo}
                  className={cx('flex w-full items-center gap-2.5 border-b border-linha px-2.5 py-2 text-left last:border-0', ativo ? 'bg-aco-claro' : 'hover:bg-painel-2')}
                >
                  <Icone m={m} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{m.modulo.nome}</span>
                    <span className="block text-xs text-tinta-3 num">
                      {Math.round(l.max[0] - l.min[0])} × {Math.round(l.max[1] - l.min[1])} × {Math.round(l.max[2] - l.min[2])}
                    </span>
                  </span>
                  {m.erros.length > 0 && <span className="size-2 rounded-full bg-perigo" title={m.erros.join(' ')} />}
                </button>
              </li>
            );
          })}
        </ul>

        {!adicionando ? (
          <button className="mt-2 flex items-center gap-1 text-[13px] font-medium text-aco hover:underline" onClick={() => setAdicionando(true)}>
            <Plus className="size-4" /> Adicionar módulo
          </button>
        ) : (
          <div className="mt-2 space-y-3 rounded-md border border-aco/40 bg-aco-claro/40 p-3">
            <div>
              <div className="mb-1 text-[13px] text-tinta-2">O quê</div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1" role="radiogroup" aria-label="Tipo do novo módulo">
                {CATEGORIAS.map((cat) => (
                  <div key={cat}>
                    <div className="mb-1 text-[11px] text-tinta-3">{cat}</div>
                    <div className="flex flex-wrap gap-1">
                      {templatesDeModulo()
                        .filter((t) => t.categoria === cat)
                        .map((t) => (
                          <button
                            key={t.id}
                            role="radio"
                            aria-checked={tipoNovo === t.id}
                            title={t.descricao}
                            onClick={() => setTipoNovo(t.id)}
                            className={cx('rounded-full border px-2.5 py-1 text-[12px]', tipoNovo === t.id ? 'border-aco bg-aco text-white' : 'border-linha bg-painel text-tinta-2 hover:border-tinta-3')}
                          >
                            {t.nome}
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[13px] text-tinta-2">Onde, em relação a {atual?.modulo.nome ?? 'o módulo'}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {LADOS.map((x) => (
                  <Botao
                    key={x.lado}
                    tamanho="sm"
                    onClick={() => {
                      onAdicionar(tipoNovo, x.lado);
                      setAdicionando(false);
                    }}
                  >
                    {x.icone} {x.label}
                  </Botao>
                ))}
              </div>
            </div>
            <button className="text-[13px] text-tinta-3 hover:text-tinta" onClick={() => setAdicionando(false)}>
              Cancelar
            </button>
          </div>
        )}
      </div>

      {atual && (
        <div className="space-y-4 border-t border-linha pt-4">
          {varios && (
            <div className="flex gap-2">
              <TextoInput ariaLabel="Nome do módulo" className="h-8 font-medium" valor={atual.modulo.nome} onChange={(v) => onAlterar(atual.modulo.id, (m) => ({ ...m, nome: v }))} />
            </div>
          )}
          <Campo label="Tipo">
            <Selecao
              ariaLabel="Tipo do módulo"
              valor={atual.modulo.templateId}
              onChange={(v) => onTrocarTipo(atual.modulo.id, v)}
              opcoes={templatesDeModulo().map((t) => ({ valor: t.id, label: t.nome }))}
            />
          </Campo>
          <ParamForm
            key={atual.modulo.id}
            template={templatePorId(atual.modulo.templateId)}
            params={atual.modulo.parametros}
            onChange={(params) => onAlterar(atual.modulo.id, (m) => ({ ...m, parametros: params }))}
            catalogo={catalogo}
          />
          {atual.erros.length > 0 && (
            <ul className="rounded-md bg-[#fbeeeb] p-3 text-[13px] text-perigo">
              {atual.erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          {varios && (
            <div className="border-t border-linha pt-3">
              <button className="flex items-center gap-1 text-[13px] font-medium text-tinta-2 hover:text-tinta" onClick={() => setPosicao(!posicao)} aria-expanded={posicao}>
                <ChevronRight className={cx('size-4 transition-transform', posicao && 'rotate-90')} /> Posição exata
              </button>
              {posicao && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(['X', 'Y', 'Z'] as const).map((eixo, i) => (
                    <Campo key={eixo} label={eixo} unidade="mm">
                      <NumeroInput
                        ariaLabel={`Posição ${eixo}`}
                        valor={Math.round(atual.modulo.posicao[i])}
                        passo={10}
                        onChange={(v) =>
                          onAlterar(atual.modulo.id, (m) => {
                            const pos = [...m.posicao] as Modulo['posicao'];
                            pos[i] = v;
                            return { ...m, posicao: pos };
                          })
                        }
                      />
                    </Campo>
                  ))}
                  <p className="col-span-3 text-xs text-tinta-3">X para a direita, Y para cima, Z para a frente.</p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-1">
            <Botao tamanho="sm" variante="fantasma" onClick={() => onDuplicar(atual.modulo.id)}>
              <Copy className="size-3.5" /> Duplicar
            </Botao>
            {(atual.removidas > 0 || Object.keys(atual.modulo.deslocamentos ?? {}).length > 0) && (
              <Botao tamanho="sm" variante="fantasma" onClick={() => onRestaurar(atual.modulo.id)} title="Volta as peças removidas e movidas">
                Restaurar peças
              </Botao>
            )}
            {varios && (
              <Botao tamanho="sm" variante="perigo" onClick={() => onRemover(atual.modulo.id)}>
                <Trash2 className="size-3.5" /> Remover módulo
              </Botao>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
