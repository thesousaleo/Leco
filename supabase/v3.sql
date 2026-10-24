-- =====================================================================
-- LECO 3 · atualização do banco
-- Cole no Supabase › SQL Editor › New query › Run (depois do schema.sql).
-- Pode rodar de novo sem problema. Nenhum dado existente é apagado.
-- =====================================================================

-- ---------- Preferências e temas ----------
alter table public.profiles add column if not exists prefs jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check check (theme in ('light', 'dark', 'black', 'auto'));

-- ---------- Contas: ícone e reserva de emergência ----------
alter table public.accounts add column if not exists icon text;
alter table public.accounts add column if not exists is_reserve boolean not null default false;

-- ---------- Cartões: ícone ----------
alter table public.cards add column if not exists icon text;

-- ---------- Subcategorias ----------
alter table public.categories add column if not exists parent_id uuid references public.categories (id) on delete set null;

-- ---------- Lançamentos: etiquetas, divisão, comprovante, moeda e ajuste ----------
alter table public.transactions add column if not exists tags text[] not null default '{}';
alter table public.transactions add column if not exists split_id uuid;
alter table public.transactions add column if not exists attachment text;
alter table public.transactions add column if not exists orig_amount bigint;
alter table public.transactions add column if not exists orig_currency text check (orig_currency is null or orig_currency ~ '^[A-Z]{3}$');
alter table public.transactions add column if not exists is_adjustment boolean not null default false;
alter table public.transactions add column if not exists debt_id uuid;
alter table public.transactions add column if not exists goal_id uuid;
create index if not exists transactions_split_idx on public.transactions (split_id) where split_id is not null;
create index if not exists transactions_group_idx on public.transactions (group_id) where group_id is not null;

-- ---------- Recorrências: etiquetas ----------
alter table public.recurrings add column if not exists tags text[] not null default '{}';

-- ---------- Metas automáticas ----------
alter table public.goals add column if not exists monthly_amount bigint not null default 0 check (monthly_amount >= 0);
alter table public.goals add column if not exists account_id uuid references public.accounts (id) on delete set null;
alter table public.goals add column if not exists remind_day int check (remind_day is null or remind_day between 1 and 28);

-- ---------- Modelos de lançamento ----------
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind text not null check (kind in ('in', 'out')),
  amount bigint not null default 0 check (amount >= 0),
  description text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  card_id uuid references public.cards (id) on delete set null,
  tags text[] not null default '{}',
  uses int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Dívidas e empréstimos ----------
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  direction text not null check (direction in ('owe', 'owed')),
  person text not null default '',
  total bigint not null check (total > 0),
  paid bigint not null default 0 check (paid >= 0),
  interest numeric(6, 3) not null default 0,
  installments int check (installments is null or installments between 1 and 600),
  installment_amount bigint,
  due_day int check (due_day is null or due_day between 1 and 31),
  start_date date,
  account_id uuid references public.accounts (id) on delete set null,
  notes text,
  closed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Planejamento mensal (planejado por categoria) ----------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  category_id uuid not null references public.categories (id) on delete cascade,
  amount bigint not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, month, category_id)
);

alter table public.templates enable row level security;
alter table public.debts enable row level security;
alter table public.plans enable row level security;
do $$
declare t text;
begin
  foreach t in array array['templates', 'debts', 'plans'] loop
    execute format('drop policy if exists "dados próprios" on public.%I', t);
    execute format('create policy "dados próprios" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------- Fotos de comprovante (Storage privado, uma pasta por usuário) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

drop policy if exists "comprovantes: ver os meus" on storage.objects;
create policy "comprovantes: ver os meus" on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "comprovantes: enviar os meus" on storage.objects;
create policy "comprovantes: enviar os meus" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "comprovantes: apagar os meus" on storage.objects;
create policy "comprovantes: apagar os meus" on storage.objects for delete to authenticated
  using (bucket_id = 'comprovantes' and (storage.foldername(name))[1] = (select auth.uid())::text);
