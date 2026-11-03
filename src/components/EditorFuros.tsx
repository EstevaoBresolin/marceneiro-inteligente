import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { DesenhoPeca } from '../cutplan/DesenhoPeca';
import { COR_FURO } from '../cutplan/desenho';
import type { Catalogo, ItemFerragem, Peca } from '../domain/types';
import { chaveFuro, NOMES_USINAGEM, type Borda, type Furo, type PadroesUsinagem, type TipoUsinagem } from '../domain/usinagem';
import { Botao, Campo, NumeroInput, Segmentos, Selecao } from './ui';

type Props = {
  peca: Peca;
  numero: string;
  /** ids das peças iguais que recebem o mesmo ajuste */
  iguais: string[];
  furos: Furo[];
  ferragens: ItemFerragem[];
  catalogo: Catalogo;
  usinagem: PadroesUsinagem;
  onTirarFuro: (f: Furo) => void;
  onAdicionarFuro: (f: Furo) => void;
  onRestaurarFuros: () => void;
  onFerragem: (ferragemId: string, quantidade: number) => void;
  onFechar: () => void;
};

const TIPOS: TipoUsinagem[] = ['cavilha', 'caneco', 'pino', 'puxador', 'outro'];

function padraoDoTipo(t: TipoUsinagem, u: PadroesUsinagem): { diametro: number; profundidade: number | 'passante' } {
  if (t === 'cavilha') return { diametro: u.cavilha.diametro, profundidade: u.cavilha.profFace };
  if (t === 'caneco') return { diametro: u.caneco.diametro, profundidade: u.caneco.profundidade };
  if (t === 'pino') return { diametro: u.pino.diametro, profundidade: u.pino.profundidade };
  if (t === 'puxador') return { diametro: u.puxador.diametro, profundidade: 'passante' };
  return { diametro: 8, profundidade: 10 };
}

/** Furos e ferragens de uma peça, ajustáveis à mão */
export function EditorFuros(p: Props) {
  const { peca, usinagem } = p;
  const [tipo, setTipo] = useState<TipoUsinagem>('outro');
  const [onde, setOnde] = useState<'face' | 'topo'>('face');
  const [borda, setBorda] = useState<Borda>('l1');
  const [x, setX] = useState(Math.round(peca.comprimento / 2));
  const [y, setY] = useState(Math.round(peca.largura / 2));
  const [lado, setLado] = useState<1 | -1>(1);
  const pd = padraoDoTipo(tipo, usinagem);
  const [diametro, setDiametro] = useState(pd.diametro);
  const [profundidade, setProfundidade] = useState<number | 'passante'>(pd.profundidade);
  const [novaFerragem, setNovaFerragem] = useState('');
  const temAjuste = !!peca.ajusteFuros && (peca.ajusteFuros.removidos.length > 0 || peca.ajusteFuros.extras.length > 0);
  const chapa = p.catalogo.chapas.find((c) => c.id === peca.chapaId);
  const ordenados = [...p.furos].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.x - b.x || a.y - b.y);

  const adicionar = () => {
    const f: Furo = onde === 'face' ? { tipo, onde, x, y, lado, diametro, profundidade } : { tipo, onde, x: borda === 'l1' ? 0 : borda === 'l2' ? peca.comprimento : x, y: borda === 'c1' ? 0 : borda === 'c2' ? peca.largura : y, borda, diametro, profundidade };
    p.onAdicionarFuro(f);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-tinta/40 sm:items-center sm:p-4" role="dialog" aria-modal aria-label={`Furos e ferragens de ${peca.nome}`} onMouseDown={(e) => e.target === e.currentTarget && p.onFechar()}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-xl bg-fundo p-4 shadow-xl sm:rounded-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-cond text-xl font-semibold">Furos e ferragens</h2>
            <p className="text-[13px] text-tinta-2">
              {p.numero} · {peca.nome.replace(/^.*?: /, '')} · {peca.comprimento} × {peca.largura} mm
              {p.iguais.length > 1 && <> · vale para as {p.iguais.length} peças iguais</>}
            </p>
          </div>
          <button aria-label="Fechar" onClick={p.onFechar} className="rounded p-1 text-tinta-3 hover:bg-painel-2 hover:text-tinta">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            <DesenhoPeca peca={peca} numero={p.numero} quantidade={1} furos={p.furos} chapa={chapa} fitas={p.catalogo.fitas} />
            <p className="text-[12px] text-tinta-3">x vai ao longo do comprimento a partir da ponta L1; y ao longo da largura a partir do lado C1 (a frente). Furos colocados à mão aparecem marcados com ✎ na lista.</p>
          </div>

          <div className="space-y-4">
            <section className="rounded-lg border border-linha bg-painel p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium">Furos ({p.furos.length})</h3>
                {temAjuste && (
                  <Botao tamanho="sm" variante="fantasma" onClick={p.onRestaurarFuros}>
                    <RotateCcw className="size-3.5" /> Voltar ao automático
                  </Botao>
                )}
              </div>
              <ul className="max-h-56 divide-y divide-linha overflow-y-auto text-[13px]">
                {ordenados.map((f) => (
                  <li key={`${chaveFuro(f)}-${f.manual ? 'm' : 'a'}`} className="flex items-center gap-2 py-1">
                    <span className="size-2.5 shrink-0 rounded-full border-2" style={{ borderColor: COR_FURO[f.tipo] }} />
                    <span className="flex-1">
                      {NOMES_USINAGEM[f.tipo]} {f.manual && <span title="colocado à mão">✎</span>}
                      <span className="ml-1 text-tinta-3 num">
                        Ø{f.diametro} × {f.profundidade === 'passante' ? 'passante' : f.profundidade} · {f.onde === 'topo' ? `topo ${f.borda?.toUpperCase()}` : f.lado === -1 ? 'face de trás' : 'face'} · x {Math.round(f.x)} y {Math.round(f.y)}
                      </span>
                    </span>
                    <button aria-label="Tirar furo" title="Tirar este furo" onClick={() => p.onTirarFuro(f)} className="rounded p-1 text-tinta-3 hover:bg-[#f7e6e3] hover:text-perigo">
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
                {!p.furos.length && <li className="py-2 text-tinta-3">Nenhum furo.</li>}
              </ul>

              <div className="mt-3 space-y-2 border-t border-linha pt-3">
                <div className="text-[13px] font-medium">Colocar furo</div>
                <div className="grid grid-cols-2 gap-2">
                  <Campo label="Tipo">
                    <Selecao
                      ariaLabel="Tipo do furo"
                      valor={tipo}
                      onChange={(v) => {
                        const t = v as TipoUsinagem;
                        setTipo(t);
                        const d = padraoDoTipo(t, usinagem);
                        setDiametro(d.diametro);
                        setProfundidade(d.profundidade);
                      }}
                      opcoes={TIPOS.map((t) => ({ valor: t, label: NOMES_USINAGEM[t] }))}
                    />
                  </Campo>
                  <Campo label="Onde">
                    <Segmentos valor={onde} onChange={(v) => setOnde(v as 'face' | 'topo')} opcoes={[{ valor: 'face', label: 'Face' }, { valor: 'topo', label: 'Topo' }]} />
                  </Campo>
                  {onde === 'face' ? (
                    <>
                      <Campo label="x" unidade="mm">
                        <NumeroInput ariaLabel="Posição x do furo" valor={x} min={0} max={peca.comprimento} onChange={setX} />
                      </Campo>
                      <Campo label="y" unidade="mm">
                        <NumeroInput ariaLabel="Posição y do furo" valor={y} min={0} max={peca.largura} onChange={setY} />
                      </Campo>
                      <div className="col-span-2">
                        <Segmentos valor={String(lado)} onChange={(v) => setLado(Number(v) as 1 | -1)} opcoes={[{ valor: '1', label: 'Face da frente' }, { valor: '-1', label: 'Face de trás' }]} />
                      </div>
                    </>
                  ) : (
                    <>
                      <Campo label="Borda">
                        <Selecao ariaLabel="Borda do furo" valor={borda} onChange={(v) => setBorda(v as Borda)} opcoes={['c1', 'c2', 'l1', 'l2'].map((b) => ({ valor: b, label: b.toUpperCase() }))} />
                      </Campo>
                      <Campo label={borda.startsWith('c') ? 'x' : 'y'} unidade="mm">
                        {borda.startsWith('c') ? (
                          <NumeroInput ariaLabel="Posição ao longo da borda" valor={x} min={0} max={peca.comprimento} onChange={setX} />
                        ) : (
                          <NumeroInput ariaLabel="Posição ao longo da borda" valor={y} min={0} max={peca.largura} onChange={setY} />
                        )}
                      </Campo>
                    </>
                  )}
                  <Campo label="Diâmetro" unidade="mm">
                    <NumeroInput ariaLabel="Diâmetro do furo" valor={diametro} min={1} max={60} onChange={setDiametro} />
                  </Campo>
                  <Campo label="Profundidade" unidade="mm" dica="0 = passante">
                    <NumeroInput ariaLabel="Profundidade do furo" valor={profundidade === 'passante' ? 0 : profundidade} min={0} max={60} onChange={(v) => setProfundidade(v === 0 ? 'passante' : v)} />
                  </Campo>
                </div>
                <Botao onClick={adicionar}>
                  <Plus className="size-4" /> Colocar furo
                </Botao>
              </div>
            </section>

            <section className="rounded-lg border border-linha bg-painel p-3">
              <h3 className="mb-2 font-medium">Ferragens desta peça</h3>
              <ul className="space-y-1.5 text-[13px]">
                {p.ferragens.map((f) => {
                  const fer = p.catalogo.ferragens.find((x) => x.id === f.ferragemId);
                  return (
                    <li key={f.ferragemId} className="flex items-center gap-2">
                      <span className="flex-1">{fer?.nome ?? f.ferragemId}</span>
                      <div className="w-20">
                        <NumeroInput ariaLabel={`Quantidade de ${fer?.nome ?? f.ferragemId}`} valor={f.quantidade} min={0} max={500} passo={fer?.unidade === 'm' ? 0.1 : 1} onChange={(v) => p.onFerragem(f.ferragemId, v)} />
                      </div>
                      <span className="w-8 text-tinta-3">{fer?.unidade}</span>
                      <button aria-label="Tirar ferragem" onClick={() => p.onFerragem(f.ferragemId, 0)} className="rounded p-1 text-tinta-3 hover:bg-[#f7e6e3] hover:text-perigo">
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
                {!p.ferragens.length && <li className="text-tinta-3">Nenhuma ferragem ligada a esta peça.</li>}
              </ul>
              <div className="mt-3 flex gap-2">
                <Selecao ariaLabel="Ferragem para adicionar" className="flex-1" valor={novaFerragem} onChange={setNovaFerragem} opcoes={[{ valor: '', label: 'Adicionar ferragem…' }, ...p.catalogo.ferragens.filter((f) => !p.ferragens.some((x) => x.ferragemId === f.id)).map((f) => ({ valor: f.id, label: f.nome }))]} />
                <Botao
                  disabled={!novaFerragem}
                  onClick={() => {
                    p.onFerragem(novaFerragem, 1);
                    setNovaFerragem('');
                  }}
                >
                  <Plus className="size-4" />
                </Botao>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
