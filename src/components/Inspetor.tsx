import { Copy, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { ModuloMontado } from '../domain/composicao';
import type { Chapa, Orientacao, Peca } from '../domain/types';
import { Botao, Segmentos } from './ui';

type Props = {
  peca: Peca | null;
  modulo: ModuloMontado | null;
  chapas: Chapa[];
  deslocada: boolean;
  solta: boolean;
  varios: boolean;
  onRemoverPeca: () => void;
  onVoltarLugar: () => void;
  onOrientacao: (o: Orientacao) => void;
  onAdicionarTabua: () => void;
  onDuplicarModulo: () => void;
  onRemoverModulo: () => void;
};

/** Cartão flutuante sobre o 3D com o que está selecionado */
export function Inspetor({ peca, modulo, chapas, deslocada, solta, varios, ...a }: Props) {
  if (!peca && !modulo) return null;
  const card = 'absolute bottom-3 left-3 z-10 w-[min(320px,calc(100%-24px))] rounded-lg border border-linha bg-painel/95 p-3 shadow-[0_6px_24px_rgba(34,40,43,.12)] backdrop-blur';

  if (peca) {
    const chapa = chapas.find((c) => c.id === peca.chapaId);
    return (
      <div className={card}>
        <div className="text-[11px] text-tinta-3">{modulo?.modulo.nome ?? 'Peça'}</div>
        <div className="font-cond text-[16px] font-semibold leading-tight">{peca.nome.replace(/^.*?: /, '')}</div>
        <div className="mt-0.5 text-[12px] text-tinta-2 num">
          {peca.somente3d ? 'Item visual (não entra no corte)' : `${peca.comprimento} × ${peca.largura} × ${chapa?.espessura ?? '?'} mm · ${chapa?.nome ?? ''}`}
        </div>
        {solta && peca.livre3d && (
          <div className="mt-2">
            <Segmentos
              valor={peca.livre3d.orientacao}
              onChange={(v) => a.onOrientacao(v as Orientacao)}
              opcoes={[
                { valor: 'horizontal', label: 'Deitada' },
                { valor: 'lateral', label: 'De lado' },
                { valor: 'frontal', label: 'De frente' },
              ]}
            />
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          <Botao tamanho="sm" variante="perigo" onClick={a.onRemoverPeca} title="Delete">
            <Trash2 className="size-3.5" /> Remover peça
          </Botao>
          {deslocada && !solta && (
            <Botao tamanho="sm" variante="fantasma" onClick={a.onVoltarLugar}>
              <RotateCcw className="size-3.5" /> Voltar ao lugar
            </Botao>
          )}
        </div>
      </div>
    );
  }

  const l = modulo!.limitesLocais;
  return (
    <div className={card}>
      <div className="text-[11px] text-tinta-3">Módulo</div>
      <div className="font-cond text-[16px] font-semibold leading-tight">{modulo!.modulo.nome}</div>
      <div className="mt-0.5 text-[12px] text-tinta-2 num">
        {[0, 1, 2].map((i) => Math.round(l.max[i] - l.min[i])).join(' × ')} mm{modulo!.removidas ? ` · ${modulo!.removidas} peça(s) removida(s)` : ''}
      </div>
      <p className="mt-1 text-[12px] text-tinta-3">Clique de novo numa peça para editá-la sozinha.</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <Botao tamanho="sm" variante="fantasma" onClick={a.onAdicionarTabua}>
          <Plus className="size-3.5" /> Tábua
        </Botao>
        <Botao tamanho="sm" variante="fantasma" onClick={a.onDuplicarModulo}>
          <Copy className="size-3.5" /> Duplicar
        </Botao>
        {varios && (
          <Botao tamanho="sm" variante="perigo" onClick={a.onRemoverModulo}>
            <Trash2 className="size-3.5" /> Remover
          </Botao>
        )}
      </div>
    </div>
  );
}
