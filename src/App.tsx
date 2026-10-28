import { useEffect } from 'react';
import { BotaoFeedback } from './components/Feedback';
import { Onboarding } from './components/Onboarding';
import { Admin } from './pages/Admin';
import { configurarIdentidade, iniciarTelemetria, rastrear } from './lib/telemetria';
import { cx } from './components/ui';
import { useRota } from './lib/router';
import { Catalogo } from './pages/Catalogo';
import { Config } from './pages/Config';
import { CorteAvulso } from './pages/CorteAvulso';
import { Editor } from './pages/Editor';
import { Projetos } from './pages/Projetos';
import { useApp } from './store/app';

function Marca() {
  // perfil de uma chapa: face branca com o miolo de MDF à mostra
  return (
    <svg viewBox="0 0 28 20" className="h-5 w-7" aria-hidden>
      <rect x="1" y="3" width="26" height="14" rx="1.5" fill="#b5895a" />
      <rect x="1" y="3" width="26" height="2.2" fill="#f1efe9" />
      <rect x="1" y="14.8" width="26" height="2.2" fill="#f1efe9" />
      <line x1="10" y1="1" x2="10" y2="19" stroke="#e9ecea" strokeWidth="1.6" strokeDasharray="2 1.4" />
    </svg>
  );
}

export default function App() {
  const rota = useRota();
  const carregar = useApp((s) => s.carregar);
  const carregado = useApp((s) => s.carregado);
  const onboardingConcluido = useApp((s) => s.config.onboardingConcluido);
  const ehAdmin = rota.tela === 'admin';
  useEffect(() => {
    void carregar();
    // pede ao navegador para não apagar os projetos quando faltar espaço
    void navigator.storage?.persist?.().catch(() => {});
  }, [carregar]);
  useEffect(() => {
    if (!carregado || ehAdmin) return;
    configurarIdentidade(() => {
      const e = useApp.getState().config.empresa;
      return { empresa: e.nome, responsavel: e.responsavel, telefone: e.telefone, cidade: e.cidade };
    });
    iniciarTelemetria();
  }, [carregado, ehAdmin]);
  useEffect(() => {
    if (carregado && !ehAdmin) rastrear('tela', { tela: rota.tela });
  }, [rota.tela, carregado, ehAdmin]);

  const links: [string, string, boolean][] = [
    ['#/projetos', 'Projetos', rota.tela === 'projetos' || rota.tela === 'editor'],
    ['#/corte', 'Plano de corte avulso', rota.tela === 'corte'],
    ['#/catalogo', 'Catálogo', rota.tela === 'catalogo'],
    ['#/config', 'Configurações', rota.tela === 'config'],
  ];

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-50 flex h-[52px] items-center gap-6 border-b border-linha bg-painel px-4">
        <a href="#/projetos" className="flex shrink-0 items-center gap-2">
          <Marca />
          <span className="font-cond text-[17px] font-semibold tracking-tight">Marceneiro Inteligente</span>
        </a>
        <nav className="flex gap-1 overflow-x-auto">
          {links.map(([href, label, ativo]) => (
            <a key={href} href={href} className={cx('whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium', ativo ? 'bg-painel-2 text-tinta' : 'text-tinta-3 hover:text-tinta')} aria-current={ativo ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
        {!ehAdmin && <BotaoFeedback />}
      </header>
      {rota.tela === 'projetos' && <Projetos />}
      {rota.tela === 'editor' && <Editor key={rota.id} id={rota.id} />}
      {rota.tela === 'corte' && <CorteAvulso />}
      {rota.tela === 'catalogo' && <Catalogo />}
      {rota.tela === 'config' && <Config />}
      {rota.tela === 'admin' && <Admin />}
      {carregado && !onboardingConcluido && !ehAdmin && <Onboarding />}
    </div>
  );
}
