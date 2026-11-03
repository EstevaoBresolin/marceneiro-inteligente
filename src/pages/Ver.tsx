import { Box, Check, DoorOpen, Layers, MessageCircle, Ruler, ThumbsUp } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AmostraChapa } from '../components/AmostraChapa';
import { Botao, cx } from '../components/ui';
import { limitesDe } from '../domain/composicao';
import { brl } from '../domain/money';
import type { Chapa, Peca } from '../domain/types';
import { abrirLink, aprovarLink, type LinkPublico } from '../lib/compartilhar';
import type { OpcoesCena, Vista } from '../viewer3d/Scene';

const Cena = lazy(() => import('../viewer3d/Scene').then((m) => ({ default: m.Cena })));
const nada = () => {};

/** Página pública do link: o cliente final gira o móvel, abre as portas e aprova. Sem login. */
export function Ver({ token }: { token: string }) {
  const [link, setLink] = useState<LinkPublico | null | undefined>(undefined);
  const [opcoes, setOpcoes] = useState<OpcoesCena>({ portaAberta: false, explodida: false, transparente: false, cotas: true });
  const [vista, setVista] = useState<Vista>('iso');
  const [seq, setSeq] = useState(0);
  const [nome, setNome] = useState('');
  const [comentario, setComentario] = useState('');
  const [aprovando, setAprovando] = useState(false);
  const [erro, setErro] = useState('');
  // no celular o painel começa recolhido para o 3D aparecer inteiro
  const [painel, setPainel] = useState(() => typeof matchMedia === 'undefined' || matchMedia('(min-width: 1024px)').matches);

  useEffect(() => {
    document.title = 'Projeto em 3D';
    abrirLink(token)
      .then((l) => setLink(l))
      .catch(() => setLink(null));
  }, [token]);

  const pecas = useMemo<Peca[]>(
    () => (link?.dados.pecas ?? []).map((p) => ({ quantidade: 1, podeGirar: true, bordas: { c1: null, c2: null, l1: null, l2: null }, furos: [], ...p }) as Peca),
    [link],
  );
  const chapas = useMemo<Chapa[]>(() => (link?.dados.chapas ?? []).map((c) => ({ espessura: 15, largura: 2750, altura: 1850, temVeio: false, precoCentavos: 0, ...c })), [link]);
  const limites = useMemo(() => limitesDe(pecas.flatMap((p) => (p.box3d ? [p.box3d] : []))), [pecas]);

  if (link === undefined) return <div className="grid h-dvh place-items-center bg-fundo text-tinta-3">Carregando o projeto…</div>;
  if (!link)
    return (
      <div className="grid h-dvh place-items-center bg-fundo px-6 text-center">
        <div>
          <Box className="mx-auto mb-3 size-8 text-tinta-3" />
          <h1 className="font-cond text-xl font-semibold">Link não encontrado</h1>
          <p className="mt-1 text-tinta-2">Ele pode ter sido desligado pela marcenaria. Peça um link novo.</p>
        </div>
      </div>
    );

  const d = link.dados;
  const fone = d.empresa.telefone.replace(/\D/g, '');
  const wa = fone.length >= 10 ? `https://wa.me/${fone.length <= 11 ? '55' : ''}${fone}?text=${encodeURIComponent(`Olá! Vi o projeto de ${d.projeto} em 3D e queria conversar.`)}` : null;
  const botao = (ativo: boolean, onClick: () => void, icone: React.ReactNode, texto: string) => (
    <button onClick={onClick} aria-pressed={ativo} className={cx('flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium shadow-sm', ativo ? 'bg-aco text-white' : 'bg-painel/95 text-tinta')}>
      {icone} {texto}
    </button>
  );

  return (
    <div className="flex h-dvh flex-col bg-fundo">
      <header className="flex items-center gap-3 border-b border-linha bg-painel px-4 py-2.5">
        {d.empresa.logo && <img src={d.empresa.logo} alt="" className="h-9 w-auto max-w-24 object-contain" />}
        <div className="min-w-0">
          <div className="truncate font-cond text-[17px] font-semibold leading-tight">{d.projeto}</div>
          <div className="truncate text-[12px] text-tinta-3">{d.empresa.nome ? `${d.empresa.nome}${d.empresa.cidade ? ` · ${d.empresa.cidade}` : ''}` : 'Projeto em 3D'}</div>
        </div>
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#1f8a4c] px-3 text-[13px] font-medium text-white">
            <MessageCircle className="size-4" /> <span className="hidden sm:inline">Falar com a marcenaria</span>
          </a>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[1fr_380px]">
        <div className="relative isolate min-h-[260px] flex-1 lg:h-full">
          <Suspense fallback={<div className="grid h-full place-items-center text-tinta-3">Carregando 3D…</div>}>
            <Cena
              pecas={pecas}
              chapas={chapas}
              limites={limites}
              modulos={d.modulos}
              ferramenta="mao"
              sel={{ modulo: null, peca: null }}
              onSelecionar={nada}
              onMoverModulo={nada}
              onMoverPeca={nada}
              opcoes={opcoes}
              vista={vista}
              vistaSeq={seq}
              somenteVer
            />
          </Suspense>
          <div className="absolute inset-x-0 top-3 flex flex-wrap justify-center gap-2 px-3">
            {botao(opcoes.portaAberta, () => setOpcoes((o) => ({ ...o, portaAberta: !o.portaAberta })), <DoorOpen className="size-4" />, 'Abrir')}
            {botao(opcoes.explodida, () => setOpcoes((o) => ({ ...o, explodida: !o.explodida })), <Layers className="size-4" />, 'Peças')}
            {botao(opcoes.cotas, () => setOpcoes((o) => ({ ...o, cotas: !o.cotas })), <Ruler className="size-4" />, 'Medidas')}
            {botao(false, () => (setVista('iso'), setSeq((s) => s + 1)), <Box className="size-4" />, 'Centralizar')}
          </div>
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-tinta-3 lg:bottom-3">Arraste para girar · dois dedos para aproximar</p>
        </div>

        <aside className={cx('z-10 overflow-y-auto rounded-t-2xl border-t border-linha bg-painel shadow-[0_-8px_30px_rgba(0,0,0,.12)] lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none', painel ? 'max-h-[62dvh]' : 'max-h-none')}>
          <button className="flex w-full flex-col items-center gap-1 pb-1 pt-2 lg:hidden" onClick={() => setPainel(!painel)} aria-expanded={painel} aria-label={painel ? 'Recolher painel' : 'Mostrar painel'}>
            <span className="h-1.5 w-10 rounded-full bg-linha" />
          </button>
          {!painel && (
            <div className="flex items-center justify-between gap-3 px-4 pb-4 lg:hidden">
              <div>
                {d.valorCentavos !== undefined && <div className="font-cond text-xl font-semibold num">{brl(d.valorCentavos)}</div>}
                <div className="text-[12px] text-tinta-3">{link.aprovado_em ? `Aprovado por ${link.aprovado_nome}` : d.medidas ? `${d.medidas.join(' × ')} mm` : ''}</div>
              </div>
              <Botao variante="primario" className="h-10" onClick={() => setPainel(true)}>
                {link.aprovado_em ? 'Ver detalhes' : 'Detalhes e aprovar'}
              </Botao>
            </div>
          )}
          <div className={cx('space-y-4 px-4 pb-5 lg:block lg:pt-5', !painel && 'hidden')}>
            {d.valorCentavos !== undefined && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-tinta-2">Valor</span>
                <span className="font-cond text-2xl font-semibold num">{brl(d.valorCentavos)}</span>
              </div>
            )}
            <dl className="space-y-1 text-[13px]">
              {d.cliente && (
                <div className="flex justify-between gap-3">
                  <dt className="text-tinta-2">Para</dt>
                  <dd className="text-right">{d.cliente}</dd>
                </div>
              )}
              {d.medidas && (
                <div className="flex justify-between gap-3">
                  <dt className="text-tinta-2">Medidas (L × A × P)</dt>
                  <dd className="num">{d.medidas.join(' × ')} mm</dd>
                </div>
              )}
              {d.prazoEntregaDias ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-tinta-2">Prazo de entrega</dt>
                  <dd>{d.prazoEntregaDias} dias</dd>
                </div>
              ) : null}
              {d.observacao && (
                <div className="flex justify-between gap-3">
                  <dt className="text-tinta-2">Pagamento</dt>
                  <dd className="text-right">{d.observacao}</dd>
                </div>
              )}
              {d.validade && (
                <div className="flex justify-between gap-3">
                  <dt className="text-tinta-2">Válido até</dt>
                  <dd>{d.validade}</dd>
                </div>
              )}
            </dl>
            {d.chapas.length > 0 && (
              <div>
                <div className="mb-1.5 text-[13px] text-tinta-2">Acabamentos</div>
                <ul className="space-y-1.5">
                  {d.chapas.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-[13px]">
                      <AmostraChapa chapa={c as Chapa} className="size-6" />
                      {c.nome}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-tinta-3">As cores no 3D são aproximadas. Confira o mostruário com a marcenaria.</p>
              </div>
            )}

            {link.aprovado_em ? (
              <div className="rounded-lg bg-[#e3f0e6] p-3 text-ok">
                <div className="flex items-center gap-2 font-medium">
                  <ThumbsUp className="size-4" /> Aprovado por {link.aprovado_nome}
                </div>
                <div className="text-[12px] text-tinta-2">{new Date(link.aprovado_em).toLocaleString('pt-BR')}</div>
                {link.comentario && <p className="mt-1 text-[13px] text-tinta-2">“{link.comentario}”</p>}
              </div>
            ) : (
              <form
                className="space-y-2 border-t border-linha pt-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (nome.trim().length < 2) return setErro('Escreva seu nome.');
                  setAprovando(true);
                  setErro('');
                  try {
                    const r = await aprovarLink(token, nome.trim(), comentario.trim());
                    if (r) setLink({ ...link, aprovado_em: r.aprovado_em, aprovado_nome: r.aprovado_nome, comentario: comentario.trim() || null });
                    else setErro('Este projeto já foi aprovado ou o link foi desligado.');
                  } catch {
                    setErro('Não deu para aprovar agora. Tente de novo em instantes.');
                  } finally {
                    setAprovando(false);
                  }
                }}
              >
                <div className="font-cond text-[16px] font-semibold">Gostou? Aprove o projeto</div>
                <input aria-label="Seu nome" placeholder="Seu nome" className="h-10 w-full rounded-md border border-linha bg-painel px-3 outline-none focus:border-aco" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
                <textarea aria-label="Comentário" placeholder="Algum ajuste ou observação? (opcional)" rows={2} className="w-full rounded-md border border-linha bg-painel px-3 py-2 text-[14px] outline-none focus:border-aco" value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={2000} />
                {erro && <p className="text-[13px] text-perigo">{erro}</p>}
                <Botao variante="primario" className="h-11 w-full text-[15px]" disabled={aprovando}>
                  <Check className="size-4" /> {aprovando ? 'Enviando…' : 'Aprovar projeto'}
                </Botao>
                <p className="text-[11px] text-tinta-3">Ao aprovar, a marcenaria recebe seu nome e o comentário. Se quiser mudar algo, escreva no comentário ou fale com a marcenaria.</p>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
