import { Bug, CheckCircle2, Heart, Lightbulb, MessageSquarePlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { enviarFeedback, type Feedback as TipoFeedback } from '../lib/telemetria';
import { Botao, cx } from './ui';

const TIPOS: { id: TipoFeedback['tipo']; label: string; icone: React.ReactNode; dica: string }[] = [
  { id: 'problema', label: 'Achei um problema', icone: <Bug className="size-4" />, dica: 'O que você estava fazendo e o que aconteceu de errado?' },
  { id: 'ideia', label: 'Tive uma ideia', icone: <Lightbulb className="size-4" />, dica: 'O que faltou ou o que faria você usar mais?' },
  { id: 'elogio', label: 'Gostei', icone: <Heart className="size-4" />, dica: 'O que funcionou bem para você?' },
];

async function capturarTela(): Promise<string | null> {
  try {
    const { toJpeg } = await import('html-to-image');
    const k = Math.min(1, 1280 / window.innerWidth);
    return await toJpeg(document.body, {
      quality: 0.72,
      pixelRatio: k,
      skipFonts: true,
      width: window.innerWidth,
      height: window.innerHeight,
      style: { transform: `translateY(-${window.scrollY}px)` },
      filter: (n) => !(n instanceof HTMLElement && n.dataset.semPrint !== undefined),
    });
  } catch {
    return null;
  }
}

export function BotaoFeedback() {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoFeedback['tipo']>('problema');
  const [texto, setTexto] = useState('');
  const [imagem, setImagem] = useState<string | null>(null);
  const [comImagem, setComImagem] = useState(true);
  const [estado, setEstado] = useState<'editando' | 'capturando' | 'enviando' | 'enviado' | 'guardado'>('editando');
  const area = useRef<HTMLTextAreaElement>(null);

  const abrir = async () => {
    setEstado('capturando');
    setAberto(true);
    setImagem(await capturarTela());
    setEstado('editando');
    setTimeout(() => area.current?.focus(), 50);
  };

  const fechar = () => {
    setAberto(false);
    setTexto('');
    setImagem(null);
    setEstado('editando');
  };

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aberto]);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEstado('enviando');
    const ok = await enviarFeedback({ tipo, texto: texto.trim(), imagem: comImagem ? imagem : null, tela: location.hash || '#/' });
    setEstado(ok ? 'enviado' : 'guardado');
    setTimeout(fechar, 2200);
  };

  const dica = TIPOS.find((t) => t.id === tipo)!.dica;

  return (
    <>
      <button
        data-sem-print
        onClick={abrir}
        className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-[#e7c9a6] bg-[#fbf3ea] px-2.5 py-1.5 text-[13px] font-medium text-mdf-escuro hover:bg-[#f6e7d6]"
      >
        <MessageSquarePlus className="size-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {aberto && (
        <div data-sem-print className="fixed inset-0 z-[100] grid place-items-center bg-tinta/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
          <div role="dialog" aria-modal="true" aria-label="Enviar feedback" className="w-full max-w-lg rounded-xl bg-painel p-5 shadow-[0_20px_60px_rgba(34,40,43,.3)]">
            {estado === 'enviado' || estado === 'guardado' ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto size-10 text-ok" />
                <p className="mt-3 font-cond text-lg font-semibold">Recebido, obrigado!</p>
                <p className="mt-1 text-[13px] text-tinta-2">{estado === 'enviado' ? 'Cada mensagem é lida.' : 'Sem internet agora: guardei e mando sozinho quando a conexão voltar.'}</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h2 className="font-cond text-xl font-semibold">Como está sendo usar?</h2>
                    <p className="text-[13px] text-tinta-3">Vai direto para quem está construindo o sistema.</p>
                  </div>
                  <button aria-label="Fechar" onClick={fechar} className="text-tinta-3 hover:text-tinta">
                    <X className="size-5" />
                  </button>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-1.5" role="radiogroup">
                  {TIPOS.map((t) => (
                    <button
                      key={t.id}
                      role="radio"
                      aria-checked={tipo === t.id}
                      onClick={() => setTipo(t.id)}
                      className={cx('flex flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-[12px] font-medium', tipo === t.id ? 'border-aco bg-aco-claro text-aco' : 'border-linha text-tinta-2 hover:border-tinta-3')}
                    >
                      {t.icone}
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={area}
                  aria-label="Sua mensagem"
                  placeholder={dica}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  className="min-h-28 w-full rounded-md border border-linha p-2.5 outline-none focus:border-aco focus:ring-2 focus:ring-aco-claro"
                />
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-16 w-28 shrink-0 overflow-hidden rounded border border-linha bg-painel-2">
                    {estado === 'capturando' ? (
                      <div className="grid h-full place-items-center text-[11px] text-tinta-3">capturando…</div>
                    ) : imagem ? (
                      <img src={imagem} alt="Print da tela" className={cx('h-full w-full object-cover object-top', !comImagem && 'opacity-30')} />
                    ) : (
                      <div className="grid h-full place-items-center text-[11px] text-tinta-3">sem print</div>
                    )}
                  </div>
                  {imagem && (
                    <label className="flex items-center gap-2 text-[13px] text-tinta-2">
                      <input type="checkbox" className="size-4 accent-aco" checked={comImagem} onChange={(e) => setComImagem(e.target.checked)} />
                      Mandar o print da tela junto
                    </label>
                  )}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Botao variante="fantasma" onClick={fechar}>
                    Cancelar
                  </Botao>
                  <Botao variante="primario" onClick={enviar} disabled={!texto.trim() || estado !== 'editando'}>
                    {estado === 'enviando' ? 'Enviando…' : 'Enviar'}
                  </Botao>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
