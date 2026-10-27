import { ArrowLeft, Box, Camera, DoorOpen, Eye, FileDown, FileSpreadsheet, Image, Layers, Plus, Ruler, Trash2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CustosView } from '../components/CustosView';
import { ParamForm } from '../components/ParamForm';
import { TabelaPecas } from '../components/TabelaPecas';
import { Abas, Botao, Campo, DinheiroInput, NumeroInput, TextoInput, cx } from '../components/ui';
import { calcularCustos } from '../costing/calcularCustos';
import { precoSugerido } from '../costing/precoSugerido';
import { PlanoCorteView } from '../cutplan/PlanoCorteView';
import { brl, fmtNum, novoId } from '../domain/money';
import type { Peca, Projeto } from '../domain/types';
import { ir } from '../lib/router';
import { usePlanoCorte } from '../lib/usePlanoCorte';
import { useApp } from '../store/app';
import { templatePorId, TEMPLATES } from '../templates';
import type { CenaHandle, OpcoesCena, Vista } from '../viewer3d/Scene';

const Cena = lazy(() => import('../viewer3d/Scene').then((m) => ({ default: m.Cena })));

type Aba = 'pecas' | 'corte' | 'custos' | 'exportar';

/** junta as peças geradas pelo template com as que o usuário editou à mão */
function mesclarPecas(geradas: Peca[], salvas: Peca[]): Peca[] {
  return geradas.map((g) => {
    const s = salvas.find((x) => x.id === g.id && x.editadaManualmente);
    return s ? { ...s, box3d: g.box3d, somente3d: g.somente3d } : g;
  });
}

export function Editor({ id }: { id: string }) {
  const { projetos, catalogo, config, salvarProjeto, carregado } = useApp();
  const original = projetos.find((p) => p.id === id);
  const [p, setP] = useState<Projeto | null>(original ?? null);
  const [aba, setAba] = useState<Aba>('pecas');
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesCena>({ portaAberta: false, explodida: false, transparente: false, cotas: true });
  const [vista, setVista] = useState<Vista>('iso');
  const [vistaSeq, setVistaSeq] = useState(0);
  const [exportando, setExportando] = useState<string | null>(null);
  const cena = useRef<CenaHandle>(null);

  useEffect(() => {
    if (!p && original) setP(original);
  }, [original, p]);

  // salva com debounce
  useEffect(() => {
    if (!p) return;
    const t = setTimeout(() => salvarProjeto(p), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  const template = templatePorId(p?.templateId ?? 'livre');
  const livre = template.id === 'livre';
  const ctx = useMemo(() => ({ catalogo, config }), [catalogo, config]);

  const gerado = useMemo(() => (p && !livre ? template.gerar(p.parametros, ctx) : null), [p?.parametros, template, ctx, livre]); // eslint-disable-line react-hooks/exhaustive-deps
  const erros = useMemo(() => (p && template.validar ? template.validar(p.parametros, ctx) : []), [p?.parametros, template, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const pecas = useMemo(() => (!p ? [] : gerado ? mesclarPecas(gerado.pecas, p.pecas) : p.pecas), [gerado, p]);
  const ferragens = useMemo(() => [...(gerado?.ferragens ?? []), ...(p?.ferragens ?? [])], [gerado, p?.ferragens]);
  const extras = useMemo(() => [...(gerado?.extras ?? []), ...(p?.extras ?? [])], [gerado, p?.extras]);
  const lote = Math.max(1, p?.quantidadeLote ?? 1);

  const { plano, calculando } = usePlanoCorte(pecas, lote, catalogo.chapas, config.servico.kerf, config.servico.refilo);
  const custos = useMemo(
    () => calcularCustos({ pecas, lote, ferragens, extras, horasMaoDeObra: p?.horasMaoDeObra ?? 0, plano, catalogo, config }),
    [pecas, lote, ferragens, extras, p?.horasMaoDeObra, plano, catalogo, config],
  );
  const sugerido = precoSugerido(custos.unitarioCentavos, config.venda);

  if (!carregado) return <div className="p-8 text-tinta-3">Carregando…</div>;
  if (!p)
    return (
      <div className="p-8">
        <p className="mb-3">Este projeto não existe mais.</p>
        <Botao onClick={() => ir('/projetos')}>Ver projetos</Botao>
      </div>
    );

  const atualizar = (fn: (x: Projeto) => Projeto) => setP((x) => (x ? fn(x) : x));

  const alterarPeca = (peca: Peca) =>
    atualizar((x) => {
      if (livre) return { ...x, pecas: x.pecas.map((q) => (q.id === peca.id ? peca : q)) };
      const outras = x.pecas.filter((q) => q.id !== peca.id);
      return { ...x, pecas: [...outras, { ...peca, editadaManualmente: true }] };
    });

  const destravar = (pid: string) => atualizar((x) => ({ ...x, pecas: x.pecas.filter((q) => q.id !== pid) }));

  const adicionarPeca = () =>
    atualizar((x) => ({
      ...x,
      pecas: [
        ...x.pecas,
        { id: novoId(), nome: `Peça ${x.pecas.length + 1}`, chapaId: catalogo.chapas[0]?.id ?? '', comprimento: 600, largura: 300, quantidade: 1, podeGirar: true, bordas: { c1: null, c2: null, l1: null, l2: null }, furos: [] },
      ],
    }));

  const exportar = async (tipo: string) => {
    setExportando(tipo);
    try {
      const { baixar, csvListaCorte, pdfOrcamento, pdfPlanoCorte } = await import('../export/exportar');
      if (tipo === 'corte') await pdfPlanoCorte({ projeto: p.nome, plano, pecas, fitas: catalogo.fitas, lote });
      if (tipo === 'orcamento')
        await pdfOrcamento({ projeto: p.nome, imagemPng: cena.current?.capturarPng() ?? null, dimensoes: gerado?.dimensoes, pecas, chapas: catalogo.chapas, fitas: catalogo.fitas, custos, venda: config.venda });
      if (tipo === 'csv') csvListaCorte(p.nome, pecas, catalogo.chapas, catalogo.fitas, lote);
      if (tipo === 'png') {
        const png = cena.current?.capturarPng();
        if (png) {
          const bin = Uint8Array.from(atob(png.split(',')[1]), (c) => c.charCodeAt(0));
          baixar(bin, `${p.nome}.png`, 'image/png');
        }
      }
    } finally {
      setExportando(null);
    }
  };

  const totalChapas = plano.grupos.reduce((s, g) => s + g.chapas.length, 0);
  const aproveit = plano.grupos.reduce((s, g) => s + g.aproveitamentoMedio * g.chapas.length, 0) / Math.max(1, totalChapas);

  const toggle = (k: keyof OpcoesCena, icone: React.ReactNode, label: string) => (
    <button
      onClick={() => setOpcoes((o) => ({ ...o, [k]: !o[k] }))}
      aria-pressed={opcoes[k]}
      title={label}
      className={cx('flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium', opcoes[k] ? 'bg-aco text-white' : 'bg-painel/90 text-tinta-2 hover:text-tinta border border-linha')}
    >
      {icone}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="flex min-h-[calc(100vh-52px)] flex-col">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* ------------ parâmetros ------------ */}
        <aside className="border-b border-linha bg-painel lg:w-[300px] lg:shrink-0 lg:border-b-0 lg:border-r lg:overflow-y-auto lg:h-[calc(100vh-52px-56px)] lg:sticky lg:top-[52px]">
          <div className="p-4 space-y-5">
            <div>
              <button onClick={() => ir('/projetos')} className="mb-2 flex items-center gap-1 text-[13px] text-tinta-3 hover:text-tinta">
                <ArrowLeft className="size-4" /> Projetos
              </button>
              <TextoInput ariaLabel="Nome do projeto" className="h-10 font-cond text-lg font-semibold" valor={p.nome} onChange={(v) => atualizar((x) => ({ ...x, nome: v }))} />
              <select
                aria-label="Tipo de móvel"
                className="mt-2 w-full bg-transparent text-[13px] text-tinta-2 outline-none"
                value={p.templateId}
                onChange={(e) => {
                  const t = templatePorId(e.target.value);
                  atualizar((x) => ({ ...x, templateId: t.id, parametros: Object.fromEntries(t.parametros.map((d) => [d.id, x.parametros[d.id] ?? d.padrao])), pecas: t.id === 'livre' ? pecas.filter((q) => !q.somente3d) : [] }));
                }}
              >
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>

            {!livre && <ParamForm template={template} params={p.parametros} onChange={(params) => atualizar((x) => ({ ...x, parametros: params }))} catalogo={catalogo} />}
            {erros.length > 0 && (
              <ul className="rounded-md bg-[#fbeeeb] p-3 text-[13px] text-perigo">
                {erros.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-linha pt-4">
              <Campo label="Lote" unidade="un.">
                <NumeroInput ariaLabel="Quantidade a produzir" valor={p.quantidadeLote} min={1} max={500} onChange={(v) => atualizar((x) => ({ ...x, quantidadeLote: Math.max(1, Math.round(v)) }))} />
              </Campo>
              <Campo label="Mão de obra" unidade="h/un.">
                <NumeroInput ariaLabel="Horas de mão de obra por unidade" valor={p.horasMaoDeObra} min={0} passo={0.25} onChange={(v) => atualizar((x) => ({ ...x, horasMaoDeObra: v }))} />
              </Campo>
            </div>

            <div className="border-t border-linha pt-4">
              <div className="mb-2 text-[13px] text-tinta-2">Outros custos por unidade</div>
              {p.extras.map((ex, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <TextoInput ariaLabel="Descrição" className="h-8" valor={ex.descricao} onChange={(v) => atualizar((x) => ({ ...x, extras: x.extras.map((e, j) => (j === i ? { ...e, descricao: v } : e)) }))} />
                  <div className="w-28 shrink-0">
                    <DinheiroInput ariaLabel="Valor" centavos={ex.custoCentavos} onChange={(v) => atualizar((x) => ({ ...x, extras: x.extras.map((e, j) => (j === i ? { ...e, custoCentavos: v } : e)) }))} />
                  </div>
                  <button aria-label="Remover custo" className="text-tinta-3 hover:text-perigo" onClick={() => atualizar((x) => ({ ...x, extras: x.extras.filter((_, j) => j !== i) }))}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button className="flex items-center gap-1 text-[13px] font-medium text-aco hover:underline" onClick={() => atualizar((x) => ({ ...x, extras: [...x.extras, { descricao: 'Embalagem', custoCentavos: 500 }] }))}>
                <Plus className="size-4" /> Adicionar custo (embalagem, etiqueta…)
              </button>
            </div>
          </div>
        </aside>

        {/* ------------ 3D + abas ------------ */}
        <main className="flex min-w-0 flex-1 flex-col">
          {!livre && (
            <div className="relative h-[46vh] min-h-[320px] border-b border-linha lg:h-[52vh]">
              <Suspense fallback={<div className="grid h-full place-items-center text-tinta-3">Carregando 3D…</div>}>
                <Cena
                  ref={cena}
                  pecas={pecas}
                  chapas={catalogo.chapas}
                  dimensoes={gerado?.dimensoes ?? { largura: 0, altura: 0, profundidade: 0 }}
                  opcoes={opcoes}
                  vista={vista}
                  vistaSeq={vistaSeq}
                  selecionada={selecionada}
                  onSelecionar={(sid) => {
                    setSelecionada(sid);
                    if (sid) setAba('pecas');
                  }}
                />
              </Suspense>
              <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                {toggle('portaAberta', <DoorOpen className="size-4" />, 'Abrir porta')}
                {toggle('explodida', <Layers className="size-4" />, 'Explodir')}
                {toggle('transparente', <Eye className="size-4" />, 'Ver dentro')}
                {toggle('cotas', <Ruler className="size-4" />, 'Cotas')}
              </div>
              <div className="absolute right-3 top-3 flex rounded-md border border-linha bg-painel/90 p-0.5">
                {(['iso', 'frente', 'lado', 'topo'] as Vista[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setVista(v);
                      setVistaSeq((s) => s + 1);
                    }}
                    className={cx('h-7 rounded px-2 text-[12px]', vista === v ? 'bg-aco-claro text-aco font-medium' : 'text-tinta-2 hover:text-tinta')}
                  >
                    {{ iso: '3D', frente: 'Frente', lado: 'Lado', topo: 'Topo' }[v]}
                  </button>
                ))}
              </div>
              <button onClick={() => exportar('png')} title="Salvar imagem" className="absolute bottom-3 right-3 flex h-8 items-center gap-1.5 rounded-md border border-linha bg-painel/90 px-2 text-[12px] text-tinta-2 hover:text-tinta">
                <Camera className="size-4" /> Imagem
              </button>
              {gerado && (
                <div className="absolute bottom-3 left-3 rounded-md bg-painel/90 px-2 py-1 text-[12px] text-tinta-2 num border border-linha">
                  {gerado.dimensoes.largura} × {gerado.dimensoes.altura} × {gerado.dimensoes.profundidade} mm
                </div>
              )}
            </div>
          )}

          <div className="flex-1 bg-painel">
            <Abas<Aba>
              valor={aba}
              onChange={setAba}
              abas={[
                { id: 'pecas', label: `Peças (${pecas.filter((x) => !x.somente3d).reduce((s, x) => s + x.quantidade, 0)})` },
                { id: 'corte', label: <>Plano de corte{calculando && <span className="ml-1.5 inline-block size-1.5 animate-pulse rounded-full bg-mdf align-middle" />}</> },
                { id: 'custos', label: 'Custos' },
                { id: 'exportar', label: 'Exportar' },
              ]}
            />
            {aba === 'pecas' && (
              <>
                <TabelaPecas
                  pecas={pecas}
                  chapas={catalogo.chapas}
                  fitas={catalogo.fitas}
                  lote={lote}
                  selecionada={selecionada}
                  onSelecionar={setSelecionada}
                  onAlterar={alterarPeca}
                  onAdicionar={livre ? adicionarPeca : undefined}
                  onRemover={livre ? (pid) => atualizar((x) => ({ ...x, pecas: x.pecas.filter((q) => q.id !== pid) })) : undefined}
                  onDestravar={livre ? undefined : destravar}
                />
                {!livre && pecas.some((x) => x.editadaManualmente) && (
                  <p className="px-3 pb-3 text-[12px] text-tinta-3">Peças com cadeado foram editadas à mão e não mudam quando você altera as medidas do móvel.</p>
                )}
                {ferragens.length > 0 && (
                  <div className="border-t border-linha px-3 py-3 text-[13px]">
                    <span className="text-tinta-3">Ferragens por unidade: </span>
                    {ferragens
                      .map((f) => {
                        const fer = catalogo.ferragens.find((x) => x.id === f.ferragemId);
                        return fer ? `${f.quantidade}× ${fer.nome}` : null;
                      })
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                )}
              </>
            )}
            {aba === 'corte' && <PlanoCorteView plano={plano} pecas={pecas} fitas={catalogo.fitas} calculando={calculando} />}
            {aba === 'custos' && <CustosView custos={custos} venda={config.venda} />}
            {aba === 'exportar' && (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { id: 'corte', icone: <FileDown className="size-5" />, titulo: 'Plano de corte (PDF)', texto: 'Uma chapa por página, com legenda e fitas. Para mandar à marcenaria.' },
                  { id: 'orcamento', icone: <FileDown className="size-5" />, titulo: 'Ficha e orçamento (PDF)', texto: 'Imagem 3D, medidas, lista de peças, custos e preço sugerido.' },
                  { id: 'csv', icone: <FileSpreadsheet className="size-5" />, titulo: 'Lista de corte (CSV)', texto: 'Abre no Excel ou em outro programa de corte.' },
                  { id: 'png', icone: <Image className="size-5" />, titulo: 'Imagem do 3D (PNG)', texto: 'Para anúncio ou para mostrar ao cliente.' },
                ]
                  .filter((x) => !(livre && (x.id === 'png')))
                  .map((x) => (
                    <button key={x.id} onClick={() => exportar(x.id)} disabled={!!exportando} className="rounded-lg border border-linha p-4 text-left hover:border-aco hover:bg-aco-claro/40 disabled:opacity-50">
                      <div className="mb-2 text-aco">{x.icone}</div>
                      <div className="font-medium">{exportando === x.id ? 'Gerando…' : x.titulo}</div>
                      <div className="mt-1 text-[13px] text-tinta-3">{x.texto}</div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ------------ rodapé fixo ------------ */}
      <footer className="sticky bottom-0 z-10 flex h-14 items-center gap-6 overflow-x-auto border-t border-linha bg-tinta px-4 text-white">
        <Box className="size-4 shrink-0 text-mdf" />
        {[
          ['Custo por unidade', brl(custos.unitarioCentavos)],
          ['Preço sugerido', sugerido === null ? '—' : brl(sugerido)],
          ['Chapas', calculando && !totalChapas ? '…' : String(totalChapas)],
          ['Aproveitamento', totalChapas ? `${fmtNum(aproveit * 100, 0)}%` : '—'],
          ...(lote > 1 ? [['Lote', `${lote} un. · ${brl(custos.totalLoteCentavos)}`]] : []),
        ].map(([k, v]) => (
          <div key={k} className="shrink-0">
            <div className="text-[11px] text-white/55">{k}</div>
            <div className={cx('font-cond text-[17px] font-semibold num leading-tight', k === 'Preço sugerido' && 'text-[#e9d8c3]')}>{v}</div>
          </div>
        ))}
      </footer>
    </div>
  );
}
