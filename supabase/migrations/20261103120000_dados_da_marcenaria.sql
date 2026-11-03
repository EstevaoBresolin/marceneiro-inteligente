-- Aplicada no projeto Supabase "marceneiro-inteligente" (sa-east-1).
-- Cada conta (uma marcenaria) guarda o próprio catálogo, configurações e projetos.
create table public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  catalogo jsonb,
  config jsonb,
  atualizado_em bigint not null default 0,
  criado_em timestamptz not null default now()
);

create table public.projetos (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  dados jsonb,
  apagado boolean not null default false,
  atualizado_em bigint not null,
  gravado_em timestamptz not null default now(),
  primary key (user_id, id)
);
create index projetos_user_atualizado on public.projetos (user_id, atualizado_em desc);

alter table public.perfis enable row level security;
alter table public.projetos enable row level security;

create policy "perfil: dono lê" on public.perfis for select to authenticated using ((select auth.uid()) = user_id);
create policy "perfil: dono cria" on public.perfis for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "perfil: dono altera" on public.perfis for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "projetos: dono lê" on public.projetos for select to authenticated using ((select auth.uid()) = user_id);
create policy "projetos: dono cria" on public.projetos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "projetos: dono altera" on public.projetos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "projetos: dono apaga" on public.projetos for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.marcar_gravado() returns trigger language plpgsql set search_path = '' as $$
begin new.gravado_em := now(); return new; end $$;
create trigger projetos_gravado before insert or update on public.projetos for each row execute function public.marcar_gravado();

revoke all on public.perfis, public.projetos from anon;
grant select, insert, update on public.perfis to authenticated;
grant select, insert, update, delete on public.projetos to authenticated;
