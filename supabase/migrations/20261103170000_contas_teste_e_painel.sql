-- Teste grátis de 45 dias por conta e painel da equipe.
-- (aplicada no projeto; a linha da equipe é o user_id do Estevão)
create table public.contas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text, marcenaria text, cnpj text, responsavel text, telefone text, cidade text,
  criado_em timestamptz not null default now(),
  teste_ate timestamptz not null default (now() + interval '45 days'),
  ultimo_acesso timestamptz,
  status_contato text not null default 'novo' check (status_contato in ('novo', 'contatado', 'usando', 'sem_resposta', 'quer_assinar', 'assinou', 'desistiu')),
  anotacoes text not null default '',
  proximo_contato date,
  plano text not null default 'teste' check (plano in ('teste', 'pago', 'cortesia'))
);
alter table public.contas enable row level security;
create table public.equipe (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.equipe enable row level security;

create or replace function public.eh_equipe() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.equipe where user_id = (select auth.uid()));
$$;
create policy "contas: dono lê" on public.contas for select to authenticated using ((select auth.uid()) = user_id or (select public.eh_equipe()));
create policy "contas: equipe altera" on public.contas for update to authenticated using ((select public.eh_equipe())) with check ((select public.eh_equipe()));
create policy "equipe: equipe lê" on public.equipe for select to authenticated using ((select public.eh_equipe()));
revoke all on public.contas, public.equipe from anon;
grant select, update on public.contas to authenticated;
grant select on public.equipe to authenticated;

create or replace function public.criar_conta_teste() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.contas (user_id, email) values (new.id, new.email) on conflict (user_id) do nothing;
  return new;
end $$;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.criar_conta_teste();

create or replace function public.atualizar_minha_conta(marcenaria text, cnpj text, responsavel text, telefone text, cidade text)
returns public.contas language plpgsql security definer set search_path = '' as $$
declare r public.contas;
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  insert into public.contas (user_id, email) values (auth.uid(), (select email from auth.users where id = auth.uid())) on conflict (user_id) do nothing;
  update public.contas c set
    marcenaria = left(nullif(trim(atualizar_minha_conta.marcenaria), ''), 120),
    cnpj = left(nullif(trim(atualizar_minha_conta.cnpj), ''), 30),
    responsavel = left(nullif(trim(atualizar_minha_conta.responsavel), ''), 120),
    telefone = left(nullif(trim(atualizar_minha_conta.telefone), ''), 30),
    cidade = left(nullif(trim(atualizar_minha_conta.cidade), ''), 120),
    ultimo_acesso = now()
  where c.user_id = auth.uid()
  returning * into r;
  return r;
end $$;

create or replace function public.painel_contas()
returns table (user_id uuid, email text, marcenaria text, cnpj text, responsavel text, telefone text, cidade text,
  criado_em timestamptz, teste_ate timestamptz, ultimo_acesso timestamptz, status_contato text, anotacoes text,
  proximo_contato date, plano text, projetos bigint, links bigint, aprovados bigint, ultima_alteracao timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.eh_equipe() then raise exception 'acesso negado'; end if;
  return query
  select c.user_id, c.email, c.marcenaria, c.cnpj, c.responsavel, c.telefone, c.cidade, c.criado_em, c.teste_ate, c.ultimo_acesso,
         c.status_contato, c.anotacoes, c.proximo_contato, c.plano,
         (select count(*) from public.projetos p where p.user_id = c.user_id and not p.apagado),
         (select count(*) from public.compartilhamentos s where s.user_id = c.user_id),
         (select count(*) from public.compartilhamentos s where s.user_id = c.user_id and s.aprovado_em is not null),
         (select max(p.gravado_em) from public.projetos p where p.user_id = c.user_id)
  from public.contas c order by c.criado_em desc;
end $$;

revoke all on function public.atualizar_minha_conta(text, text, text, text, text) from public;
revoke all on function public.painel_contas() from public;
revoke all on function public.eh_equipe() from public;
revoke all on function public.criar_conta_teste() from public;
grant execute on function public.atualizar_minha_conta(text, text, text, text, text) to authenticated;
grant execute on function public.painel_contas() to authenticated;
grant execute on function public.eh_equipe() to authenticated;

-- Teste vencido: lê (para baixar o backup), mas não grava.
create or replace function public.conta_ativa() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.contas c where c.user_id = (select auth.uid()) and (c.plano <> 'teste' or c.teste_ate > now()))
      or exists (select 1 from public.equipe e where e.user_id = (select auth.uid()));
$$;
revoke all on function public.conta_ativa() from public;
grant execute on function public.conta_ativa() to authenticated;
-- (as políticas de insert/update de perfis, projetos e compartilhamentos passam a exigir conta_ativa())
