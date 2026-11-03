import { FolderOpen, Layers, Package, Scissors, Settings } from 'lucide-react';
import { useEffect } from 'react';
import { BotaoFeedback } from './components/Feedback';
import { Onboarding } from './components/Onboarding';
import { Admin } from './pages/Admin';
import { Producao } from './pages/Producao';
import { Termos } from './pages/Termos';
import { configurarIdentidade, configurarPermissao, iniciarTelemetria, rastrear } from './lib/telemetria';
import { cx } from './components/ui';
import { useRota } from './lib/router';
import { Catalogo } from './pages/Catalogo';
import { Config } from './pages/Config';
import { CorteAvulso } from './pages/CorteAvulso';
import { Editor } from './pages/Editor';
import { Projetos } from './pages/Projetos';
import { ponteStore, useApp } from './store/app';
import { iniciarNuvem, nuvemAtiva, useNuvem } from './lib/nuvem';
import { Conta } from './components/Conta';
import { Entrar, NovaSenha } from './pages/Entrar';
import { Ver } from './pages/Ver';
import { Painel } from './pages/Painel';
import { TesteTerminou } from './components/TesteTerminou';
import { carregarConta, diasRestantes, enviarDadosEmpresa, testeAcabou, textoDias, useConta } from './lib/conta';

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
  const termosAceitos = useApp((s) => !!s.config.termosAceitosEm);
  const setConfig = useApp((s) => s.setConfig);
  const ehAdmin = rota.tela === 'admin';
  const nuvem = useNuvem();
  useEffect(() => {
    void carregar().then(() => iniciarNuvem(ponteStore));
    // pede ao navegador para não apagar os projetos quando faltar espaço
    void navigator.storage?.persist?.().catch(() => {});
  }, [carregar]);
  const semRegistro = ehAdmin || rota.tela === 'ver';
  useEffect(() => {
    if (!carregado || semRegistro) return;
    configurarPermissao(() => useApp.getState().config.enviarUso !== false);
    configurarIdentidade(() => {
      const e = useApp.getState().config.empresa;
      return { empresa: e.nome, responsavel: e.responsavel, telefone: e.telefone, cidade: e.cidade };
    });
    iniciarTelemetria();
  }, [carregado, semRegistro]);
  useEffect(() => {
    if (carregado && !semRegistro) rastrear('tela', { tela: rota.tela });
  }, [rota.tela, carregado, semRegistro]);
  // período de teste: conta da marcenaria no Supabase, e os dados de contato vão para o painel da equipe
  const conta = useConta();
  const empresa = useApp((s) => s.config.empresa);
  const uid = nuvem.sessao?.user.id;
  useEffect(() => {
    if (uid) void carregarConta();
  }, [uid]);
  useEffect(() => {
    if (uid && carregado && nuvem.puxouUmaVez) enviarDadosEmpresa(empresa);
  }, [uid, carregado, nuvem.puxouUmaVez, empresa]);

  // quem aceitou os termos ao criar a conta não precisa aceitar de novo
  const termosNaConta = nuvem.sessao?.user.user_metadata?.termos_aceitos_em as string | undefined;
  useEffect(() => {
    if (carregado && nuvem.puxouUmaVez && termosNaConta && !useApp.getState().config.termosAceitosEm) setConfig((c) => void (c.termosAceitosEm = Date.parse(termosNaConta) || Date.now()));
  }, [carregado, nuvem.puxouUmaVez, termosNaConta, setConfig]);

  // link público do 3D: tela própria, sem login, sem menu e sem registro de uso
  if (rota.tela === 'ver') return <Ver token={rota.token} />;
  const livre = ehAdmin || rota.tela === 'termos';
  if (nuvemAtiva && !livre) {
    if (!nuvem.pronto) return <div className="grid min-h-full place-items-center text-tinta-3">Carregando…</div>;
    if (nuvem.recuperandoSenha && nuvem.sessao) return <NovaSenha />;
    if (!nuvem.sessao) return <Entrar />;
  }
  const acabou = nuvemAtiva && testeAcabou(conta.conta) && !conta.equipe && !livre && rota.tela !== 'painel';
  const mostrarOnboarding = carregado && !onboardingConcluido && !ehAdmin && nuvem.puxouUmaVez && !acabou;
  const dias = conta.conta?.plano === 'teste' ? diasRestantes(conta.conta) : null;

  const links: [string, string, boolean, string, React.ReactNode][] = [
    ['#/projetos', 'Projetos', rota.tela === 'projetos' || rota.tela === 'editor', 'Projetos', <FolderOpen className="size-5" />],
    ['#/producao', 'Corte da semana', rota.tela === 'producao', 'Semana', <Layers className="size-5" />],
    ['#/corte', 'Corte avulso', rota.tela === 'corte', 'Avulso', <Scissors className="size-5" />],
    ['#/catalogo', 'Catálogo', rota.tela === 'catalogo', 'Catálogo', <Package className="size-5" />],
    ['#/config', 'Configurações', rota.tela === 'config', 'Ajustes', <Settings className="size-5" />],
  ];
  // no celular o menu vai para baixo; no editor sai, porque o rodapé de custos ocupa esse lugar
  const menuDeBaixo = !ehAdmin && rota.tela !== 'editor' && rota.tela !== 'termos';

  return (
    <div className={cx('min-h-full', menuDeBaixo && 'pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0')}>
      <header className="sticky top-0 z-50 flex h-[52px] items-center gap-6 border-b border-linha bg-painel px-4">
        <a href="#/projetos" className="flex min-w-0 shrink items-center gap-2">
          <Marca />
          <span className="truncate font-cond text-[17px] font-semibold tracking-tight md:hidden xl:inline">Marceneiro Inteligente</span>
        </a>
        <nav className="hidden gap-1 overflow-x-auto md:flex">
          {links.map(([href, label, ativo]) => (
            <a key={href} href={href} className={cx('whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium', ativo ? 'bg-painel-2 text-tinta' : 'text-tinta-3 hover:text-tinta')} aria-current={ativo ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {!ehAdmin && <BotaoFeedback />}
          {nuvemAtiva && nuvem.sessao && !ehAdmin && <Conta />}
        </div>
      </header>
      {carregado && onboardingConcluido && !termosAceitos && !ehAdmin && rota.tela !== 'termos' && (
        <div className="flex flex-wrap items-center justify-center gap-3 border-b border-[#e7c9a6] bg-[#fbf3ea] px-4 py-2 text-[13px]">
          <span>Este sistema está em teste. Leia e aceite os termos: seus projetos ficam guardados na sua conta e recebemos só registros simples de uso.</span>
          <a href="#/termos" className="font-medium text-aco hover:underline">
            Ler termos
          </a>
          <button className="rounded-md bg-aco px-2.5 py-1 font-medium text-white" onClick={() => setConfig((c) => void (c.termosAceitosEm = Date.now()))}>
            Aceito
          </button>
        </div>
      )}
      {dias !== null && dias > 0 && dias <= 10 && !acabou && (
        <div className="border-b border-[#e7c9a6] bg-[#fbf3ea] px-4 py-1.5 text-center text-[13px]">
          Teste grátis: <b>{textoDias(dias)}</b>. Para continuar depois disso, fale com a gente.
        </div>
      )}
      {acabou && <TesteTerminou />}
      {!acabou && (
        <>
      {rota.tela === 'projetos' && <Projetos />}
      {rota.tela === 'editor' && <Editor key={rota.id} id={rota.id} />}
      {rota.tela === 'corte' && <CorteAvulso />}
      {rota.tela === 'catalogo' && <Catalogo />}
      {rota.tela === 'config' && <Config />}
      {rota.tela === 'admin' && <Admin />}
      {rota.tela === 'producao' && <Producao />}
      {rota.tela === 'termos' && <Termos />}
      {rota.tela === 'painel' && <Painel />}
        </>
      )}
      {mostrarOnboarding && <Onboarding />}
      {menuDeBaixo && (
        <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-linha bg-painel pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Menu">
          {links.map(([href, , ativo, curto, icone]) => (
            <a key={href} href={href} aria-current={ativo ? 'page' : undefined} className={cx('flex h-[60px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', ativo ? 'text-aco' : 'text-tinta-3')}>
              {icone}
              {curto}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
