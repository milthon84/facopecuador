-- =====================================================
-- MIGRACIÓN: NOTAS DE CRÉDITO ELECTRÓNICAS (SRI)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- 1. Tabla: credit_notes (Cabecera de Notas de Crédito)
create table if not exists public.credit_notes (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  credit_note_number text, -- Formato: Estab-PtoEmi-Secuencial (ej. 001-001-000000001)
  secuencial int,
  issue_date date not null default current_date,

  -- Datos del cliente / comprador
  client_name text not null,
  client_document text not null,
  client_email text,
  client_phone text,
  client_address text,

  -- Datos del documento modificado / sustento
  cod_doc_modificado text not null default '01', -- 01 = Factura
  num_doc_modificado text not null, -- N° de Factura modificada (ej. 001-001-000000010)
  fecha_emision_doc_sustento text not null, -- Formato DD/MM/YYYY
  motivo text not null, -- Razón de la modificación (ej. Anulación total, Devolución, Descuento)

  -- Valores monetarios
  subtotal_15 numeric not null default 0,
  subtotal_0 numeric not null default 0,
  subtotal_no_iva numeric not null default 0,
  subtotal_exento numeric not null default 0,
  total_discount numeric not null default 0,
  iva_rate numeric not null default 15,
  iva_amount numeric not null default 0,
  total numeric not null default 0, -- valorModificacion

  -- SRI y Estado
  sri_access_key text, -- Clave de 49 dígitos (tipo 04)
  sri_status text not null default 'draft', -- draft, submitted, authorized, rejected, error
  sri_environment text not null default '1',
  sri_authorization_number text,
  sri_authorization_date timestamptz,
  sri_error_messages jsonb,

  xml_url text,
  pdf_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint credit_notes_secuencial_unique unique (secuencial)
);

create index if not exists idx_credit_notes_invoice on public.credit_notes (invoice_id);
create index if not exists idx_credit_notes_status on public.credit_notes (sri_status);

-- Trigger para updated_at
drop trigger if exists trg_credit_notes_updated_at on public.credit_notes;
create trigger trg_credit_notes_updated_at
  before update on public.credit_notes
  for each row execute function public.set_updated_at();

-- 2. Tabla: credit_note_items (Detalle de Nota de Crédito)
create table if not exists public.credit_note_items (
  id uuid primary key default uuid_generate_v4(),
  credit_note_id uuid not null references public.credit_notes(id) on delete cascade,
  code text,
  description text not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  discount numeric not null default 0 check (discount >= 0),
  iva_code text not null default '4', -- '4' = 15%, '0' = 0%
  total numeric not null check (total >= 0)
);

create index if not exists idx_credit_note_items_cn on public.credit_note_items (credit_note_id);

-- 3. Secuencia dedicada para Notas de Crédito
create sequence if not exists public.credit_note_secuencial_seq
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

-- Si ya existen notas de crédito, alinear la secuencia
do $$
declare
  max_sec int;
begin
  select coalesce(max(secuencial), 0) into max_sec from public.credit_notes;
  if max_sec > 0 then
    perform setval('public.credit_note_secuencial_seq', max_sec);
  end if;
end;
$$;

-- Función atómica para el secuencial de Nota de Crédito
create or replace function public.next_credit_note_secuencial()
returns int
language sql
security definer
as $$
  select nextval('public.credit_note_secuencial_seq')::int;
$$;

grant execute on function public.next_credit_note_secuencial() to authenticated;
grant execute on function public.next_credit_note_secuencial() to service_role;

-- 4. RLS y Permisos
alter table public.credit_notes enable row level security;
alter table public.credit_note_items enable row level security;

create policy admin_all_credit_notes on public.credit_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all_credit_note_items on public.credit_note_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
