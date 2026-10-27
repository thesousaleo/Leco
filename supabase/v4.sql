-- =====================================================================
-- LECO 4 · vale-alimentação e vale-refeição
-- Cole no Supabase › SQL Editor › New query › Run. Pode rodar de novo.
-- Cria o tipo de conta "beneficio" e guarda os dados do benefício
-- (alimentação, refeição ou flexível; operadora; valor e dia do crédito).
-- =====================================================================
alter table public.accounts drop constraint if exists accounts_kind_check;
alter table public.accounts add constraint accounts_kind_check
  check (kind in ('corrente', 'poupanca', 'carteira', 'investimento', 'outro', 'beneficio'));

-- {"type": "va" | "vr" | "flex", "provider": "Alelo", "credit": 60000, "day": 1, "recurring_id": "..."}
alter table public.accounts add column if not exists benefit jsonb;
