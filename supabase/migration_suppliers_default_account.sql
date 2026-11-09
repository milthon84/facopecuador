-- =====================================================================================
-- MIGRACIÓN: Tabla de Proveedores con Cuenta Contable Habitual
-- y vinculación directa de Cuentas de Movimiento en Gastos y Detalle de Compras
-- =====================================================================================

-- 1. Tabla de Proveedores (memoria de cuenta habitual)
create table if not exists public.suppliers (
  id                   uuid primary key default uuid_generate_v4(),
  ruc                  text unique not null,
  razon_social         text not null,
  default_group_code   text,
  default_group_name   text,
  default_account_code text references public.accounts(code) on update cascade on delete set null,
  default_account_name text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_suppliers_ruc on public.suppliers (ruc);

alter table public.suppliers enable row level security;
drop policy if exists "suppliers_all_authenticated" on public.suppliers;
create policy "suppliers_all_authenticated" on public.suppliers for all using (true) with check (true);
grant all on public.suppliers to authenticated, service_role;
grant select on public.suppliers to anon;

-- 2. Agregar columnas de cuenta contable en expenses
alter table public.expenses
  add column if not exists account_code text,
  add column if not exists account_name text,
  add column if not exists group_code text,
  add column if not exists group_name text;

create index if not exists idx_expenses_account_code on public.expenses (account_code);

-- 3. Agregar columnas de cuenta contable en expense_items
alter table public.expense_items
  add column if not exists account_code text,
  add column if not exists account_name text,
  add column if not exists group_code text,
  add column if not exists group_name text;

create index if not exists idx_expense_items_account_code on public.expense_items (account_code);

-- 4. Inicializar suppliers con proveedores históricos existentes en expenses
insert into public.suppliers (ruc, razon_social, default_account_code, default_account_name, default_group_code, default_group_name)
select distinct on (supplier_ruc)
  supplier_ruc as ruc,
  supplier_name as razon_social,
  null as default_account_code,
  null as default_account_name,
  null as default_group_code,
  null as default_group_name
from public.expenses
where supplier_ruc is not null and btrim(supplier_ruc) <> ''
on conflict (ruc) do nothing;
