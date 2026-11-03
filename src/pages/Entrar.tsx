import { useState } from 'react';
import { Botao, Campo } from '../components/ui';
import { supabase, useNuvem } from '../lib/nuvem';

type Modo = 'entrar' | 'criar' | 'esqueci';

const traduzir = (m: string) => {
  const t = m.toLowerCase();
  if (t.includes('invalid login')) return 'E-mail ou senha errados.';
  if (t.includes('email not confirmed')) return 'Falta confirmar o e-mail: abra o link que enviamos para você.';
  if (t.includes('already registered') || t.includes('already been registered')) return 'Esse e-mail já tem conta. Use "Entrar".';
  if (t.includes('password should be') || t.includes('weak')) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (t.includes('rate limit')) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if (t.includes('valid email') || t.includes('invalid format')) return 'Esse e-mail não parece válido.';
  if (t.includes('failed to fetch') || t.includes('network')) return 'Sem conexão com a internet.';
  return m;
};

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-full place-items-center bg-fundo px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 text-center">
          <div className="font-cond text-[26px] font-semibold tracking-tight">Marceneiro Inteligente</div>
          <p className="mt-1 text-[14px] text-tinta-2">Projete em 3D, gere o plano de corte e saiba o preço certo.</p>
        </div>
        <div className="rounded-xl border border-linha bg-painel p-6 shadow-[0_8px_30px_rgba(0,0,0,.05)]">{children}</div>
      </div>
    </div>
  );
}

export function Entrar() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setErro('');
    setAviso('');
    setOcupado(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) setErro(traduzir(error.message));
      } else if (modo === 'criar') {
        if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { emailRedirectTo: location.origin + location.pathname, data: { termos_aceitos_em: new Date().toISOString() } },
        });
        if (error) setErro(traduzir(error.message));
        else if (!data.session) setAviso(`Enviamos um link de confirmação para ${email.trim()}. Abra o e-mail e clique no link para entrar.`);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname });
        if (error) setErro(traduzir(error.message));
        else setAviso('Se esse e-mail tiver conta, chega um link para criar uma senha nova.');
      }
    } catch (x) {
      setErro(traduzir(String((x as Error)?.message ?? x)));
    } finally {
      setOcupado(false);
    }
  };

  const trocar = (m: Modo) => {
    setModo(m);
    setErro('');
    setAviso('');
  };

  return (
    <Moldura>
      <h1 className="mb-4 font-cond text-xl font-semibold">{modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta da marcenaria' : 'Esqueci a senha'}</h1>
      <form onSubmit={enviar} className="space-y-3">
        <Campo label="E-mail">
          <input type="email" autoComplete="email" required className="h-10 w-full rounded-md border border-linha bg-painel px-2.5 outline-none focus:border-aco focus:ring-2 focus:ring-aco-claro" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        {modo !== 'esqueci' && (
          <Campo label="Senha" dica={modo === 'criar' ? 'Pelo menos 8 caracteres.' : undefined}>
            <input
              type="password"
              autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
              required
              className="h-10 w-full rounded-md border border-linha bg-painel px-2.5 outline-none focus:border-aco focus:ring-2 focus:ring-aco-claro"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </Campo>
        )}
        {modo === 'criar' && (
          <label className="flex items-start gap-2 text-[13px] text-tinta-2">
            <input type="checkbox" className="mt-0.5 size-4 accent-aco" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
            <span>
              Li e aceito os{' '}
              <a href="#/termos" target="_blank" className="text-aco underline">
                termos do período de teste
              </a>
              .
            </span>
          </label>
        )}
        {erro && <p className="text-[13px] text-perigo">{erro}</p>}
        {aviso && <p className="rounded-md bg-[#e3f0e6] px-3 py-2 text-[13px] text-ok">{aviso}</p>}
        <Botao variante="primario" className="h-10 w-full" disabled={ocupado || (modo === 'criar' && !aceito)}>
          {ocupado ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Mandar link'}
        </Botao>
      </form>
      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-linha pt-4 text-[13px]">
        {modo !== 'entrar' ? (
          <button className="text-aco hover:underline" onClick={() => trocar('entrar')}>
            Já tenho conta
          </button>
        ) : (
          <button className="text-aco hover:underline" onClick={() => trocar('criar')}>
            Criar conta
          </button>
        )}
        {modo !== 'esqueci' && (
          <button className="text-tinta-3 hover:text-tinta" onClick={() => trocar('esqueci')}>
            Esqueci a senha
          </button>
        )}
      </div>
    </Moldura>
  );
}

export function NovaSenha() {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  return (
    <Moldura>
      <h1 className="mb-4 font-cond text-xl font-semibold">Criar senha nova</h1>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
          setOcupado(true);
          const { error } = await supabase!.auth.updateUser({ password: senha });
          setOcupado(false);
          if (error) setErro(traduzir(error.message));
          else useNuvem.setState({ recuperandoSenha: false });
        }}
      >
        <Campo label="Senha nova" dica="Pelo menos 8 caracteres.">
          <input type="password" autoComplete="new-password" className="h-10 w-full rounded-md border border-linha bg-painel px-2.5 outline-none focus:border-aco focus:ring-2 focus:ring-aco-claro" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        {erro && <p className="text-[13px] text-perigo">{erro}</p>}
        <Botao variante="primario" className="h-10 w-full" disabled={ocupado}>
          Salvar senha
        </Botao>
      </form>
    </Moldura>
  );
}
