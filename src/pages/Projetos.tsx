import { Copy, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Botao, Titulo } from '../components/ui';
import type { Projeto } from '../domain/types';
import { ir } from '../lib/router';
import { useApp } from '../store/app';
import { montarProjeto } from '../domain/composicao';
import { CATEGORIAS, templatePorId, TEMPLATES, type Template } from '../templates';

/** Silhueta frontal simples, desenhada a partir das caixas 3D (sem WebGL) */
function Miniatura({ projeto }: { projeto: Projeto }) {
  const { catalogo, config } = useApp();
  const t = templatePorId(projeto.templateId);
  if (t.id === 'livre')
    return (
      <svg viewBox="0 0 100 70" className="h-full w-full">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={14} y={12 + i * 13} width={72 - i * 9} height={8} rx={1} fill="#e9d8c3" stroke="#b5895a" strokeWidth={0.8} />
        ))}
      </svg>
    );
  let r;
  try {
    r = montarProjeto(projeto, { catalogo, config });
  } catch {
    return null;
  }
  const caixas = r.pecas.filter((p) => p.box3d).map((p) => ({ p, b: p.box3d! }));
  if (!caixas.length) return null;
  const minX = Math.min(...caixas.map(({ b }) => b.pos[0] - b.size[0] / 2));
  const maxX = Math.max(...caixas.map(({ b }) => b.pos[0] + b.size[0] / 2));
  const minY = Math.min(...caixas.map(({ b }) => b.pos[1] - b.size[1] / 2));
  const maxY = Math.max(...caixas.map(({ b }) => b.pos[1] + b.size[1] / 2));
  const w = maxX - minX;
  const h = maxY - minY;
  const pad = Math.max(w, h) * 0.12;
  // ordem de desenho: de trás para frente
  const ordenadas = [...caixas].sort((a, b) => a.b.pos[2] + a.b.size[2] / 2 - (b.b.pos[2] + b.b.size[2] / 2));
  return (
    <svg viewBox={`${minX - pad} ${-maxY - pad} ${w + 2 * pad} ${h + 2 * pad}`} className="h-full w-full">
      {ordenadas.map(({ p, b }) => (
        <rect
          key={p.id}
          x={b.pos[0] - b.size[0] / 2}
          y={-(b.pos[1] + b.size[1] / 2)}
          width={b.size[0]}
          height={b.size[1]}
          fill={p.papel === 'espelho' ? '#cfe0e8' : catalogo.chapas.find((c) => c.id === p.chapaId)?.cor ?? '#eee'}
          stroke={p.papel === 'espelho' ? '#8aa5b3' : '#7e6a55'}
          strokeWidth={Math.max(w, h) / 160}
        />
      ))}
    </svg>
  );
}

function NovoProjeto({ onEscolher }: { onEscolher: (t: Template) => void }) {
  const grupos: [string, Template[]][] = [...CATEGORIAS.map((c) => [c, TEMPLATES.filter((t) => t.categoria === c)] as [string, Template[]]), ['Sem 3D', TEMPLATES.filter((t) => !t.categoria)]];
  return (
    <div className="space-y-5">
      {grupos.map(([cat, ts]) => (
        <div key={cat}>
          <h3 className="mb-2 text-[13px] font-medium text-tinta-3">{cat}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ts.map((t) => (
              <button key={t.id} onClick={() => onEscolher(t)} className="rounded-lg border border-linha bg-painel p-4 text-left transition-colors hover:border-aco">
                <div className="font-cond text-[15px] font-semibold">{t.nome}</div>
                <div className="mt-1 text-[13px] text-tinta-3">{t.descricao}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Projetos() {
  const { projetos, novoProjeto, duplicarProjeto, removerProjeto, carregado } = useApp();
  const [escolhendo, setEscolhendo] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const criar = (t: Template) => {
    const p = novoProjeto(t.id);
    ir(`/editor/${p.id}`);
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <Titulo sub="Escolha um móvel, digite as medidas e veja peças, plano de corte e custo na hora.">Projetos</Titulo>
        {projetos.length > 0 && (
          <Botao variante="primario" onClick={() => setEscolhendo(!escolhendo)}>
            {escolhendo ? 'Cancelar' : 'Novo projeto'}
          </Botao>
        )}
      </div>

      {(escolhendo || (carregado && projetos.length === 0)) && (
        <div className="mb-8">
          {projetos.length === 0 && <p className="mb-3 font-medium">Comece escolhendo o que você vai fabricar:</p>}
          <NovoProjeto onEscolher={criar} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projetos.map((p) => (
          <article key={p.id} className="group overflow-hidden rounded-lg border border-linha bg-painel">
            <button onClick={() => ir(`/editor/${p.id}`)} className="block w-full text-left">
              <div className="h-40 border-b border-linha bg-painel-2 p-4">
                <Miniatura projeto={p} />
              </div>
              <div className="p-4 pb-2">
                <h2 className="font-cond text-[17px] font-semibold">{p.nome}</h2>
                <p className="text-[13px] text-tinta-3">
                  {p.modulos && p.modulos.length > 1 ? p.modulos.map((m) => m.nome).join(' + ') : templatePorId(p.templateId).nome}
                  {p.quantidadeLote > 1 ? ` · lote de ${p.quantidadeLote}` : ''} · {new Date(p.atualizadoEm).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </button>
            <div className="flex justify-end gap-1 px-3 pb-3">
              <Botao tamanho="sm" variante="fantasma" onClick={() => duplicarProjeto(p.id)}>
                <Copy className="size-3.5" /> Duplicar
              </Botao>
              {confirmar === p.id ? (
                <Botao tamanho="sm" variante="perigo" onClick={() => removerProjeto(p.id)}>
                  Confirmar exclusão
                </Botao>
              ) : (
                <Botao tamanho="sm" variante="fantasma" onClick={() => setConfirmar(p.id)}>
                  <Trash2 className="size-3.5" /> Excluir
                </Botao>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
