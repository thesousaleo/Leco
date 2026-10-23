-- =====================================================================
-- LECO · agente do WhatsApp
-- Cole no Supabase › SQL Editor › New query › Run (depois do schema.sql).
-- Pode rodar de novo sem problema.
-- =====================================================================

-- Telefone vinculado a cada usuário (um telefone por conta)
create table if not exists public.whatsapp_links (
  phone text primary key check (phone ~ '^\d{8,15}$'),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Códigos temporários para vincular (válidos por 15 minutos)
create table if not exists public.whatsapp_codes (
  code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);

-- Mensagens já processadas (evita lançar duas vezes se a Meta reenviar)
create table if not exists public.whatsapp_messages (
  id text primary key,
  phone text not null,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_messages_phone_idx on public.whatsapp_messages (phone, created_at desc);

-- Lançamentos feitos pelo agente (para o botão Desfazer)
create table if not exists public.whatsapp_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tx_ids uuid[] not null,
  undone boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.whatsapp_links enable row level security;
alter table public.whatsapp_codes enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_batches enable row level security;

-- No app, o usuário vê e remove apenas o próprio vínculo. Os demais acessos são feitos só pela função do servidor.
drop policy if exists "ver meu vínculo" on public.whatsapp_links;
create policy "ver meu vínculo" on public.whatsapp_links for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "remover meu vínculo" on public.whatsapp_links;
create policy "remover meu vínculo" on public.whatsapp_links for delete to authenticated using (user_id = (select auth.uid()));

-- Gera um código novo de vinculação para o usuário logado
create or replace function public.create_whatsapp_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
  exp timestamptz := now() + interval '15 minutes';
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  delete from public.whatsapp_codes c where c.user_id = auth.uid() or c.expires_at < now();
  loop
    new_code := 'LECO-' || lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.whatsapp_codes c where c.code = new_code);
  end loop;
  insert into public.whatsapp_codes (code, user_id, expires_at) values (new_code, auth.uid(), exp);
  return query select new_code, exp;
end;
$$;

revoke all on function public.create_whatsapp_code() from public, anon;
grant execute on function public.create_whatsapp_code() to authenticated;

-- Limpeza: mensagens processadas com mais de 30 dias
create or replace function public.whatsapp_cleanup()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.whatsapp_messages where created_at < now() - interval '30 days';
  delete from public.whatsapp_codes where expires_at < now();
  delete from public.whatsapp_batches where created_at < now() - interval '7 days';
$$;
revoke all on function public.whatsapp_cleanup() from public, anon, authenticated;
