-- =====================================================
-- MIGRACIÓN: CIERRE ANUAL FISCAL Y CONTABLE DE EMPRESAS
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- ── TABLA: Cierres Anuales ────────────────────────────────────────────────
create table if not exists public.annual_closures (
  id                       uuid primary key default uuid_generate_v4(),
  year                     integer not null unique,        -- Ej: 2025
  status                   text not null default 'closed',-- closed | reopened
  closed_at                timestamptz not null default now(),
  closed_by_id             uuid references auth.users(id) on delete set null,
  closed_by_email          text,
  reopened_at              timestamptz,
  reopened_by_id           uuid references auth.users(id) on delete set null,
  reopened_by_email        text,
  reopen_reason            text,                          -- Motivo obligatorio de reapertura
  closing_entry_id         uuid references public.journal_entries(id) on delete set null,
  total_income             numeric(12,2) not null default 0,
  total_expenses           numeric(12,2) not null default 0,
  gross_profit             numeric(12,2) not null default 0,
  employee_profit_sharing  numeric(12,2) not null default 0, -- 15% Trabajadores
  income_tax               numeric(12,2) not null default 0, -- 25% Impuesto Renta
  net_profit               numeric(12,2) not null default 0, -- Utilidad Neta a Patrimonio
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_annual_closures_year on public.annual_closures (year);
create index if not exists idx_annual_closures_status on public.annual_closures (status);

-- ── TABLA: Bitácora / Historial de Auditoría de Cierres Anuales ────────────
create table if not exists public.annual_closure_logs (
  id                       uuid primary key default uuid_generate_v4(),
  annual_closure_id        uuid references public.annual_closures(id) on delete cascade,
  year                     integer not null,
  action                   text not null,                 -- 'close' | 'reopen'
  executed_by_id           uuid references auth.users(id) on delete set null,
  executed_by_email        text,
  executed_at              timestamptz not null default now(),
  reason                   text,
  closing_entry_id         uuid references public.journal_entries(id) on delete set null,
  total_income             numeric(12,2) not null default 0,
  total_expenses           numeric(12,2) not null default 0,
  gross_profit             numeric(12,2) not null default 0,
  employee_profit_sharing  numeric(12,2) not null default 0,
  income_tax               numeric(12,2) not null default 0,
  net_profit               numeric(12,2) not null default 0
);

create index if not exists idx_annual_closure_logs_year on public.annual_closure_logs (year);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.annual_closures    enable row level security;
alter table public.annual_closure_logs enable row level security;

drop policy if exists "Auth annual_closures"    on public.annual_closures;
drop policy if exists "Auth annual_closure_logs" on public.annual_closure_logs;

create policy "Auth annual_closures"
  on public.annual_closures for all using (auth.role() = 'authenticated');
create policy "Auth annual_closure_logs"
  on public.annual_closure_logs for all using (auth.role() = 'authenticated');
