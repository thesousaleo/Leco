-- =====================================================================
-- LECO · limite diário da leitura de comprovantes por IA
-- Cole no Supabase › SQL Editor › New query › Run. Pode rodar de novo.
-- Protege a sua chave do Gemini contra uso exagerado (padrão: 40 leituras por usuário por dia).
-- =====================================================================
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
-- Sem políticas: só o servidor (função do Supabase) mexe nesta tabela.

create or replace function public.ai_use(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  insert into public.ai_usage (user_id, day, count) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into n;
  delete from public.ai_usage where day < current_date - 30;
  return n <= p_limit;
end;
$$;
revoke all on function public.ai_use(uuid, int) from public, anon, authenticated;
grant execute on function public.ai_use(uuid, int) to service_role;
