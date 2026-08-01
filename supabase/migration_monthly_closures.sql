-- =====================================================
-- MIGRACIÓN: CIERRE MENSUAL CONTABLE Y AUDITORÍA
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- ── TABLA: Cierres Mensuales ───────────────────────────────────────────────
create table if not exists public.monthly_closures (
  id                uuid primary key default uuid_generate_v4(),
  period            text not null unique,           -- Ej: "2026-07"
  status            text not null default 'closed', -- closed | reopened
  closed_at         timestamptz not null default now(),
  closed_by_id      uuid references auth.users(id) on delete set null,
  closed_by_email   text,
  reopened_at       timestamptz,
  reopened_by_id    uuid references auth.users(id) on delete set null,
  reopened_by_email text,
  reopen_reason     text,                           -- Justificación obligatoria de reapertura
  closing_entry_id  uuid references public.journal_entries(id) on delete set null,
  total_income      numeric(12,2) not null default 0,
  total_expenses    numeric(12,2) not null default 0,
  net_profit        numeric(12,2) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_monthly_closures_period on public.monthly_closures (period);
create index if not exists idx_monthly_closures_status on public.monthly_closures (status);

-- ── TABLA: Bitácora / Historial de Auditoría de Cierres y Reaperturas ─────
create table if not exists public.monthly_closure_logs (
  id                uuid primary key default uuid_generate_v4(),
  closure_id        uuid references public.monthly_closures(id) on delete cascade,
  period            text not null,
  action            text not null,                  -- 'close' | 'reopen'
  executed_by_id    uuid references auth.users(id) on delete set null,
  executed_by_email text,
  executed_at       timestamptz not null default now(),
  reason            text,                           -- Motivo / justificación
  closing_entry_id  uuid references public.journal_entries(id) on delete set null,
  total_income      numeric(12,2) not null default 0,
  total_expenses    numeric(12,2) not null default 0,
  net_profit        numeric(12,2) not null default 0
);

create index if not exists idx_monthly_closure_logs_period on public.monthly_closure_logs (period);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.monthly_closures    enable row level security;
alter table public.monthly_closure_logs enable row level security;

drop policy if exists "Auth monthly_closures"    on public.monthly_closures;
drop policy if exists "Auth monthly_closure_logs" on public.monthly_closure_logs;

create policy "Auth monthly_closures"
  on public.monthly_closures for all using (auth.role() = 'authenticated');
create policy "Auth monthly_closure_logs"
  on public.monthly_closure_logs for all using (auth.role() = 'authenticated');
