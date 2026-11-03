-- Link público para o cliente final ver o móvel em 3D e aprovar.
create table public.compartilhamentos (
  token text primary key default encode(extensions.gen_random_bytes(18), 'hex'),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  projeto_id text not null,
  dados jsonb not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  visto_em timestamptz,
  aprovado_em timestamptz,
  aprovado_nome text,
  comentario text,
  unique (user_id, projeto_id)
);

alter table public.compartilhamentos enable row level security;
create policy "links: dono lê" on public.compartilhamentos for select to authenticated using ((select auth.uid()) = user_id);
create policy "links: dono cria" on public.compartilhamentos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "links: dono altera" on public.compartilhamentos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "links: dono apaga" on public.compartilhamentos for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.compartilhamentos from anon;
grant select, insert, update, delete on public.compartilhamentos to authenticated;

-- O cliente (sem login) só enxerga um link pelo token, nunca a tabela.
create or replace function public.ver_compartilhamento(t text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.compartilhamentos;
begin
  if t is null or length(t) < 20 then return null; end if;
  select * into r from public.compartilhamentos where token = t and ativo;
  if not found then return null; end if;
  if r.visto_em is null then update public.compartilhamentos set visto_em = now() where token = t; end if;
  return jsonb_build_object('dados', r.dados, 'atualizado_em', r.atualizado_em, 'aprovado_em', r.aprovado_em, 'aprovado_nome', r.aprovado_nome, 'comentario', r.comentario);
end $$;

create or replace function public.aprovar_compartilhamento(t text, nome text, comentario text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.compartilhamentos;
begin
  if nome is null or length(trim(nome)) < 2 or length(nome) > 120 or length(coalesce(comentario, '')) > 2000 then
    raise exception 'dados inválidos';
  end if;
  update public.compartilhamentos
     set aprovado_em = now(), aprovado_nome = trim(nome), comentario = nullif(trim(coalesce(aprovar_compartilhamento.comentario, '')), '')
   where token = t and ativo and aprovado_em is null
  returning * into r;
  if not found then return null; end if;
  return jsonb_build_object('aprovado_em', r.aprovado_em, 'aprovado_nome', r.aprovado_nome);
end $$;

revoke all on function public.ver_compartilhamento(text) from public;
revoke all on function public.aprovar_compartilhamento(text, text, text) from public;
grant execute on function public.ver_compartilhamento(text) to anon, authenticated;
grant execute on function public.aprovar_compartilhamento(text, text, text) to anon, authenticated;
