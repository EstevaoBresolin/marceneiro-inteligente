import { Lock, Plus, Trash2 } from 'lucide-react';
import { NOMES_FURO, type Bordas, type Chapa, type FitaBorda, type Peca } from '../domain/types';
import { NumeroInput, Selecao, TextoInput, cx } from './ui';

/** Mini-desenho da peça: clique em cada lado para pôr/tirar fita */
function BordasEditor({ bordas, fitaPadrao, onChange }: { bordas: Bordas; fitaPadrao: string | null; onChange: (b: Bordas) => void }) {
  const lado = (k: keyof Bordas) => ({
    onClick: () => onChange({ ...bordas, [k]: bordas[k] ? null : fitaPadrao }),
    className: cx('cursor-pointer transition-colors', bordas[k] ? 'stroke-mdf' : 'stroke-linha hover:stroke-tinta-3'),
    strokeWidth: bordas[k] ? 5 : 3,
    strokeLinecap: 'round' as const,
  });
  return (
    <svg viewBox="0 0 60 34" className="h-7 w-12" aria-label="Fitas de borda">
      <rect x="6" y="6" width="48" height="22" fill="#f5f2ec" />
      <line x1="6" y1="5" x2="54" y2="5" {...lado('c1')}>
        <title>Comprimento (frente)</title>
      </line>
      <line x1="6" y1="29" x2="54" y2="29" {...lado('c2')}>
        <title>Comprimento (trás)</title>
      </line>
      <line x1="5" y1="6" x2="5" y2="28" {...lado('l1')}>
        <title>Largura (esquerda)</title>
      </line>
      <line x1="55" y1="6" x2="55" y2="28" {...lado('l2')}>
        <title>Largura (direita)</title>
      </line>
    </svg>
  );
}

type Props = {
  pecas: Peca[];
  chapas: Chapa[];
  fitas: FitaBorda[];
  lote?: number;
  selecionada?: string | null;
  onSelecionar?: (id: string | null) => void;
  onAlterar: (p: Peca) => void;
  onAdicionar?: () => void;
  onRemover?: (id: string) => void;
  onDestravar?: (id: string) => void;
  numeros?: Map<string, string>;
};

export function TabelaPecas({ pecas, chapas, fitas, lote = 1, selecionada, onSelecionar, onAlterar, onAdicionar, onRemover, onDestravar, numeros }: Props) {
  const linhas = pecas.filter((p) => !p.somente3d);
  const fitaPadrao = fitas[0]?.id ?? null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-[13px]">
        <thead>
          <tr className="text-left text-tinta-3 border-b border-linha">
            <th className="px-3 py-2 font-medium">Peça</th>
            <th className="px-2 py-2 font-medium">Chapa</th>
            <th className="px-2 py-2 font-medium text-right">Compr.</th>
            <th className="px-2 py-2 font-medium text-right">Larg.</th>
            <th className="px-2 py-2 font-medium text-right">Qtd</th>
            <th className="px-2 py-2 font-medium" title="Pode girar no plano de corte">Gira</th>
            <th className="px-2 py-2 font-medium">Fita</th>
            <th className="px-2 py-2 font-medium">Furos</th>
            <th className="w-16" />
          </tr>
        </thead>
        <tbody>
          {linhas.map((p) => {
            const chapa = chapas.find((c) => c.id === p.chapaId);
            const ativa = selecionada === p.id;
            return (
              <tr
                key={p.id}
                onClick={() => onSelecionar?.(ativa ? null : p.id)}
                className={cx('border-b border-linha last:border-0', ativa ? 'bg-aco-claro' : 'hover:bg-painel-2')}
              >
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                  {numeros?.get(p.id) && <span className="w-7 shrink-0 font-cond text-[12px] font-bold text-tinta-3">{numeros.get(p.id)}</span>}
                  <TextoInput ariaLabel="Nome da peça" className="h-8" valor={p.nome} onChange={(v) => onAlterar({ ...p, nome: v, editadaManualmente: true })} />
                  </div>
                </td>
                <td className="px-2 py-1.5 min-w-40">
                  <Selecao
                    ariaLabel="Chapa"
                    className="h-8"
                    valor={p.chapaId}
                    onChange={(v) => {
                      const c = chapas.find((x) => x.id === v);
                      onAlterar({ ...p, chapaId: v, podeGirar: c ? !c.temVeio && p.podeGirar : p.podeGirar, editadaManualmente: true });
                    }}
                    opcoes={chapas.map((c) => ({ valor: c.id, label: c.nome }))}
                  />
                </td>
                <td className="px-2 py-1.5 w-24">
                  <NumeroInput ariaLabel="Comprimento" className="h-8" valor={p.comprimento} min={1} onChange={(v) => onAlterar({ ...p, comprimento: Math.round(v), editadaManualmente: true })} />
                </td>
                <td className="px-2 py-1.5 w-24">
                  <NumeroInput ariaLabel="Largura" className="h-8" valor={p.largura} min={1} onChange={(v) => onAlterar({ ...p, largura: Math.round(v), editadaManualmente: true })} />
                </td>
                <td className="px-2 py-1.5 w-20">
                  <NumeroInput ariaLabel="Quantidade" className="h-8" valor={p.quantidade} min={0} onChange={(v) => onAlterar({ ...p, quantidade: Math.round(v), editadaManualmente: true })} />
                  {lote > 1 && <div className="text-right text-[11px] text-tinta-3 num">×{lote} = {p.quantidade * lote}</div>}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    aria-label="Pode girar"
                    className="accent-aco size-4"
                    checked={p.podeGirar}
                    disabled={chapa?.temVeio}
                    title={chapa?.temVeio ? 'Chapa com veio: não gira' : ''}
                    onChange={(e) => onAlterar({ ...p, podeGirar: e.target.checked, editadaManualmente: true })}
                  />
                </td>
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <BordasEditor bordas={p.bordas} fitaPadrao={p.bordas.c1 ?? p.bordas.c2 ?? p.bordas.l1 ?? p.bordas.l2 ?? fitaPadrao} onChange={(b) => onAlterar({ ...p, bordas: b, editadaManualmente: true })} />
                </td>
                <td className="px-2 py-1.5 text-tinta-2">
                  {p.furos.filter((f) => f.quantidade > 0).map((f) => `${f.quantidade}× ${NOMES_FURO[f.tipo].toLowerCase()}`).join(', ') || '—'}
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {p.editadaManualmente && onDestravar && (
                    <button
                      className="p-1 text-mdf-escuro hover:text-tinta"
                      title="Editada à mão: mudar as medidas do móvel não altera esta peça. Clique para voltar ao cálculo automático."
                      onClick={(e) => {
                        e.stopPropagation();
                        onDestravar(p.id);
                      }}
                    >
                      <Lock className="size-4" />
                    </button>
                  )}
                  {onRemover && (
                    <button
                      className="p-1 text-tinta-3 hover:text-perigo"
                      aria-label={`Remover ${p.nome}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemover(p.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {onAdicionar && (
        <button className="m-3 inline-flex items-center gap-1 text-[13px] font-medium text-aco hover:underline" onClick={onAdicionar}>
          <Plus className="size-4" /> Adicionar peça
        </button>
      )}
    </div>
  );
}
