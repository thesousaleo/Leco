-- =====================================================================
-- LECO · banco de dados (Supabase / PostgreSQL)
-- Cole este ficheiro inteiro no Supabase › SQL Editor › New query › Run.
-- Pode rodar de novo sem problema: só cria o que ainda não existe.
-- Cada usuário só enxerga e altera os próprios dados (Row Level Security).
-- Valores em centavos (bigint). Datas no formato AAAA-MM-DD.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Perfil e preferências ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  theme text not null default 'light' check (theme in ('light', 'dark')),
  hide_values boolean not null default false,
  savings_goal int not null default 20 check (savings_goal between 0 and 100),
  notify_bills boolean not null default true,
  notify_budget boolean not null default true,
  notify_goals boolean not null default true,
  bill_days_before int not null default 2 check (bill_days_before between 0 and 10),
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Contas e carteiras ----------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind text not null default 'corrente' check (kind in ('corrente', 'poupanca', 'carteira', 'investimento', 'outro')),
  initial_balance bigint not null default 0,
  color text not null default '#14806B',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Cartões de crédito ----------
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  limit_amount bigint not null default 0 check (limit_amount >= 0),
  closing_day int not null default 1 check (closing_day between 1 and 31),
  due_day int not null default 10 check (due_day between 1 and 31),
  color text not null default '#0F5C4D',
  pay_account_id uuid references public.accounts (id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Categorias ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  kind text not null check (kind in ('in', 'out')),
  icon text not null default 'tag',
  color text not null default '#14806B',
  budget bigint not null default 0 check (budget >= 0),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Lançamentos recorrentes (contas fixas) ----------
create table if not exists public.recurrings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('in', 'out')),
  amount bigint not null check (amount > 0),
  description text not null check (char_length(description) between 1 and 60),
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  card_id uuid references public.cards (id) on delete set null,
  frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'yearly')),
  next_date date not null,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Transações ----------
-- kind: in (receita), out (despesa), transfer (entre contas), card_payment (pagamento de fatura)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('in', 'out', 'transfer', 'card_payment')),
  amount bigint not null check (amount > 0),
  description text not null default '',
  date date not null,
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete cascade,
  to_account_id uuid references public.accounts (id) on delete cascade,
  card_id uuid references public.cards (id) on delete cascade,
  invoice text check (invoice is null or invoice ~ '^\d{4}-\d{2}$'),
  installment int,
  installments int,
  group_id uuid,
  recurring_id uuid references public.recurrings (id) on delete set null,
  paid boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  constraint transactions_recurring_date_key unique (recurring_id, date)
);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);
create index if not exists transactions_card_invoice_idx on public.transactions (card_id, invoice);

-- ---------- Metas ----------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default 'target',
  target bigint not null check (target > 0),
  saved bigint not null default 0 check (saved >= 0),
  due date,
  created_at timestamptz not null default now()
);

-- ---------- Segurança por usuário (RLS) ----------
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.cards enable row level security;
alter table public.categories enable row level security;
alter table public.recurrings enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;

drop policy if exists "perfil próprio" on public.profiles;
create policy "perfil próprio" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['accounts', 'cards', 'categories', 'recurrings', 'transactions', 'goals'] loop
    execute format('drop policy if exists "dados próprios" on public.%I', t);
    execute format('create policy "dados próprios" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------- Ao criar a conta: perfil + categorias padrão ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, kind, icon, color) values
    (new.id, 'Moradia', 'out', 'home', '#14806B'),
    (new.id, 'Alimentação', 'out', 'utensils', '#E8A317'),
    (new.id, 'Transporte', 'out', 'car', '#5E8CA6'),
    (new.id, 'Saúde', 'out', 'heart', '#6B9E8F'),
    (new.id, 'Lazer', 'out', 'film', '#F08A6B'),
    (new.id, 'Educação', 'out', 'book', '#B8865B'),
    (new.id, 'Compras', 'out', 'bag', '#D9644A'),
    (new.id, 'Assinaturas', 'out', 'repeat', '#8C7AB8'),
    (new.id, 'Contas e serviços', 'out', 'zap', '#7A8B3F'),
    (new.id, 'Outros gastos', 'out', 'tag', '#5E8CA6'),
    (new.id, 'Salário', 'in', 'briefcase', '#14806B'),
    (new.id, 'Investimentos', 'in', 'trend', '#E8A317'),
    (new.id, 'Freelance', 'in', 'laptop', '#6B9E8F'),
    (new.id, 'Outras receitas', 'in', 'gift', '#8C7AB8');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Excluir a própria conta (apaga todos os dados) ----------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
