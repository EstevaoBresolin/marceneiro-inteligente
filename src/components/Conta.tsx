import { Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { puxar, sair, useNuvem } from '../lib/nuvem';
import { cx } from './ui';

const TEXTO = {
  ok: 'Tudo salvo na nuvem',
  sincronizando: 'Salvando na nuvem…',
  offline: 'Sem internet: salvo neste computador, sobe quando voltar',
  erro: 'Não consegui salvar na nuvem agora. Tento de novo sozinho.',
  desligada: '',
};

export function Conta() {
  const { sessao, status, ultimaSinc } = useNuvem();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false);
    addEventListener('mousedown', fora);
    return () => removeEventListener('mousedown', fora);
  }, [aberto]);
  const email = sessao?.user.email ?? '';
  const Icone = status === 'offline' || status === 'erro' ? CloudOff : status === 'sincronizando' ? RefreshCw : Cloud;

  return (
    <div className="relative" ref={caixa}>
      <button
        onClick={() => setAberto(!aberto)}
        title={TEXTO[status]}
        aria-label={`Conta ${email}. ${TEXTO[status]}`}
        className="flex h-8 items-center gap-2 rounded-md border border-linha bg-painel px-2 text-[13px] hover:bg-painel-2"
      >
        <Icone className={cx('size-4', status === 'ok' ? 'text-ok' : status === 'sincronizando' ? 'animate-spin text-tinta-3 [animation-duration:2s]' : 'text-perigo')} />
        <span className="grid size-6 place-items-center rounded-full bg-aco text-[12px] font-semibold uppercase text-white">{email.slice(0, 1)}</span>
      </button>
      {aberto && (
        <div className="absolute right-0 top-10 w-72 rounded-lg border border-linha bg-painel p-3 text-[13px] shadow-lg">
          <div className="truncate font-medium">{email}</div>
          <div className={cx('mt-1 flex items-start gap-1.5', status === 'ok' ? 'text-ok' : status === 'sincronizando' ? 'text-tinta-2' : 'text-perigo')}>
            <Icone className="mt-0.5 size-3.5 shrink-0" /> {TEXTO[status]}
          </div>
          {ultimaSinc && <div className="mt-0.5 text-[12px] text-tinta-3">Última sincronização: {new Date(ultimaSinc).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>}
          <p className="mt-2 text-[12px] text-tinta-3">Seus projetos, catálogo e preços ficam na sua conta. Entre com o mesmo e-mail em outro computador e eles aparecem lá.</p>
          <div className="mt-3 flex gap-2 border-t border-linha pt-3">
            <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-tinta-2 hover:bg-painel-2 hover:text-tinta" onClick={() => void puxar()}>
              <RefreshCw className="size-3.5" /> Sincronizar
            </button>
            <button className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-perigo hover:bg-[#f7e6e3]" onClick={() => void sair()}>
              <LogOut className="size-3.5" /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
