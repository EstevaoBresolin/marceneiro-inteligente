import { Download, LogOut, MessageCircle } from 'lucide-react';
import { sair } from '../lib/nuvem';
import { useApp } from '../store/app';
import { useBaixarBackup } from './Backup';
import { Botao } from './ui';

/** WhatsApp da equipe para quem terminou o teste (vazio = mostra só o texto) */
export const WHATSAPP_EQUIPE = import.meta.env.VITE_WHATSAPP_EQUIPE as string | undefined;

export function TesteTerminou() {
  const baixar = useBaixarBackup();
  const nome = useApp((s) => s.config.empresa.nome);
  const fone = (WHATSAPP_EQUIPE ?? '').replace(/\D/g, '');
  return (
    <div className="grid min-h-[calc(100dvh-52px)] place-items-center bg-fundo px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-linha bg-painel p-6 text-center shadow-sm">
        <h1 className="font-cond text-2xl font-semibold">Seu teste grátis terminou</h1>
        <p className="mt-2 text-tinta-2">
          Obrigado por testar o Marceneiro Inteligente{nome ? `, ${nome}` : ''}! Para continuar usando, fale com a gente. Seus projetos continuam guardados na sua conta.
        </p>
        <div className="mt-5 grid gap-2">
          {fone && (
            <a className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1f8a4c] px-4 font-medium text-white" href={`https://wa.me/${fone.length <= 11 ? '55' : ''}${fone}?text=${encodeURIComponent(`Olá! Meu teste do Marceneiro Inteligente terminou${nome ? ` (${nome})` : ''} e quero continuar.`)}`} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" /> Falar no WhatsApp
            </a>
          )}
          <Botao onClick={baixar}>
            <Download className="size-4" /> Baixar meus projetos (backup)
          </Botao>
          <Botao variante="fantasma" onClick={() => void sair()}>
            <LogOut className="size-4" /> Sair
          </Botao>
        </div>
        {!fone && <p className="mt-4 text-[12px] text-tinta-3">Fale com quem te convidou para o teste, ou use o botão Feedback lá em cima.</p>}
      </div>
    </div>
  );
}
