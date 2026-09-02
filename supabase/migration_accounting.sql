-- =====================================================
-- MIGRACIÓN: MÓDULO CONTABILIDAD NIIF - SOCIEDAD ECUADOR
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- ── TABLA: Plan de Cuentas ─────────────────────────────────────────────────
create table if not exists public.accounts (
  id          uuid primary key default uuid_generate_v4(),
  code        text not null unique,         -- Ej: "1.1.01.01"
  name        text not null,
  type        text not null,                -- ACTIVO | PASIVO | PATRIMONIO | INGRESO | GASTO
  subtype     text,                         -- corriente | no_corriente | operacional | etc.
  parent_code text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_accounts_code on public.accounts (code);
create index if not exists idx_accounts_type on public.accounts (type);

-- ── TABLA: Asientos Contables (Libro Diario) ──────────────────────────────
create table if not exists public.journal_entries (
  id               uuid primary key default uuid_generate_v4(),
  entry_date       date not null default current_date,
  description      text not null,
  reference_type   text,   -- invoice | expense | manual
  reference_id     uuid,
  status           text not null default 'posted',  -- posted | void
  created_by_id    uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_journal_entries_date on public.journal_entries (entry_date desc);
create index if not exists idx_journal_entries_ref  on public.journal_entries (reference_type, reference_id);

-- ── TABLA: Líneas del Asiento ─────────────────────────────────────────────
create table if not exists public.journal_lines (
  id               uuid primary key default uuid_generate_v4(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_code     text not null,
  account_name     text not null,
  debit            numeric(12,2) not null default 0,
  credit           numeric(12,2) not null default 0,
  description      text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_journal_lines_entry   on public.journal_lines (journal_entry_id);
create index if not exists idx_journal_lines_account on public.journal_lines (account_code);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.accounts        enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines   enable row level security;

drop policy if exists "Auth accounts"        on public.accounts;
drop policy if exists "Auth journal_entries" on public.journal_entries;
drop policy if exists "Auth journal_lines"   on public.journal_lines;

create policy "Auth accounts"
  on public.accounts for all using (auth.role() = 'authenticated');
create policy "Auth journal_entries"
  on public.journal_entries for all using (auth.role() = 'authenticated');
create policy "Auth journal_lines"
  on public.journal_lines for all using (auth.role() = 'authenticated');

-- ── PLAN DE CUENTAS NIIF — FACOP (CLÍNICA, ACADEMIA Y COWORKING) ───────
insert into public.accounts (code, name, type, subtype) values
  -- ACTIVOS
  ('1',          'ACTIVOS',                              'ACTIVO',     'grupo'),
  ('1.1',        'ACTIVO CORRIENTE',                     'ACTIVO',     'corriente'),
  ('1.1.01',     'EFECTIVO Y EQUIVALENTES',              'ACTIVO',     'corriente'),
  ('1.1.01.01',  'Caja General',                         'ACTIVO',     'corriente'),
  ('1.1.01.02',  'Caja Chica',                           'ACTIVO',     'corriente'),
  ('1.1.01.03',  'Bancos Cuentas Corrientes y Ahorros',  'ACTIVO',     'corriente'),
  ('1.1.02',     'CUENTAS POR COBRAR',                   'ACTIVO',     'corriente'),
  ('1.1.02.01',  'Cuentas por Cobrar Pacientes (Clínica)','ACTIVO',    'corriente'),
  ('1.1.02.02',  'Cuentas por Cobrar Alumnos (Cursos)',  'ACTIVO',     'corriente'),
  ('1.1.02.03',  'Cuentas por Cobrar Inquilinos (Coworking)','ACTIVO', 'corriente'),
  ('1.1.02.04',  'Anticipos a Proveedores',              'ACTIVO',     'corriente'),
  ('1.1.03',     'CRÉDITO TRIBUTARIO (SRI)',             'ACTIVO',     'corriente'),
  ('1.1.03.01',  'Crédito Tributario IVA',               'ACTIVO',     'corriente'),
  ('1.1.03.02',  'Crédito Tributario Impuesto a la Renta','ACTIVO',    'corriente'),
  ('1.1.04',     'INVENTARIOS',                          'ACTIVO',     'corriente'),
  ('1.1.04.01',  'Inventario Clínico y Educativo',       'ACTIVO',     'corriente'),

  ('1.2',        'ACTIVO NO CORRIENTE',                  'ACTIVO',     'no_corriente'),
  ('1.2.01',     'PROPIEDAD, PLANTA Y EQUIPO',           'ACTIVO',     'no_corriente'),
  ('1.2.01.01',  'Equipos Médicos y Odontológicos',      'ACTIVO',     'no_corriente'),
  ('1.2.01.02',  'Mobiliario y Enseres',                 'ACTIVO',     'no_corriente'),
  ('1.2.01.03',  'Equipos de Computación y Software',    'ACTIVO',     'no_corriente'),
  ('1.2.02',     'DEPRECIACIÓN ACUMULADA',               'ACTIVO',     'no_corriente'),
  ('1.2.02.01',  'Deprec. Acum. Equipos Médicos',        'ACTIVO',     'no_corriente'),
  ('1.2.02.02',  'Deprec. Acum. Mobiliario',             'ACTIVO',     'no_corriente'),
  ('1.2.02.03',  'Deprec. Acum. Computación',            'ACTIVO',     'no_corriente'),

  -- PASIVOS
  ('2',          'PASIVOS',                              'PASIVO',     'grupo'),
  ('2.1',        'PASIVO CORRIENTE',                     'PASIVO',     'corriente'),
  ('2.1.01',     'CUENTAS POR PAGAR',                    'PASIVO',     'corriente'),
  ('2.1.01.01',  'Cuentas por Pagar Proveedores',        'PASIVO',     'corriente'),
  ('2.1.01.02',  'Cuentas por Pagar Honorarios',         'PASIVO',     'corriente'),
  ('2.1.02',     'OBLIGACIONES LABORALES',               'PASIVO',     'corriente'),
  ('2.1.02.01',  'Sueldos e IESS por Pagar',             'PASIVO',     'corriente'),
  ('2.1.02.02',  'Beneficios Sociales por Pagar',        'PASIVO',     'corriente'),
  ('2.1.02.03',  '15% Participación Trabajadores',       'PASIVO',     'corriente'),
  ('2.1.03',     'OBLIGACIONES TRIBUTARIAS (SRI)',       'PASIVO',     'corriente'),
  ('2.1.03.01',  'IVA en Ventas por Pagar',              'PASIVO',     'corriente'),
  ('2.1.03.02',  'Retenciones por Pagar (IVA/Renta)',    'PASIVO',     'corriente'),
  ('2.1.03.03',  'Impuesto a la Renta por Pagar',        'PASIVO',     'corriente'),
  ('2.1.04',     'ANTICIPOS RECIBIDOS',                  'PASIVO',     'corriente'),
  ('2.1.04.01',  'Anticipos de Clientes (Pac/Alum/Cowork)','PASIVO',   'corriente'),

  ('2.2',        'PASIVO NO CORRIENTE',                  'PASIVO',     'no_corriente'),
  ('2.2.01',     'OBLIGACIONES FINANCIERAS LP',          'PASIVO',     'no_corriente'),
  ('2.2.01.01',  'Préstamos Bancarios a Largo Plazo',    'PASIVO',     'no_corriente'),

  -- PATRIMONIO
  ('3',          'PATRIMONIO NETO',                      'PATRIMONIO', 'grupo'),
  ('3.1',        'CAPITAL SOCIAL',                       'PATRIMONIO', 'capital'),
  ('3.1.01',     'Capital Suscrito y Pagado',            'PATRIMONIO', 'capital'),
  ('3.2',        'RESERVAS',                             'PATRIMONIO', 'reservas'),
  ('3.2.01',     'Reserva Legal',                        'PATRIMONIO', 'reservas'),
  ('3.3',        'RESULTADOS',                           'PATRIMONIO', 'resultados'),
  ('3.3.01',     'Resultados Acumulados',                'PATRIMONIO', 'resultados'),
  ('3.3.02',     'Utilidad o Pérdida del Ejercicio',     'PATRIMONIO', 'resultados'),

  -- INGRESOS
  ('4',          'INGRESOS',                             'INGRESO',    'grupo'),
  ('4.1',        'INGRESOS CLÍNICA',                     'INGRESO',    'operacional'),
  ('4.1.01',     'Servicios de Prevención e Higiene',    'INGRESO',    'operacional'),
  ('4.1.02',     'Procedimientos Restaurativos',         'INGRESO',    'operacional'),
  ('4.1.03',     'Servicios Especializados',             'INGRESO',    'operacional'),
  ('4.1.04',     'Tratamientos Estéticos',               'INGRESO',    'operacional'),
  ('4.2',        'INGRESOS ACADEMIA',                    'INGRESO',    'operacional'),
  ('4.2.01',     'Cursos, Diplomados y Matrículas',      'INGRESO',    'operacional'),
  ('4.3',        'INGRESOS COWORKING',                   'INGRESO',    'operacional'),
  ('4.3.01',     'Alquiler de Aulas y Puestos de Trabajo','INGRESO',   'operacional'),
  ('4.4',        'OTROS INGRESOS',                       'INGRESO',    'no_operacional'),
  ('4.4.01',     'Intereses y Otros Ingresos',           'INGRESO',    'no_operacional'),

  -- GASTOS
  ('5',          'COSTOS Y GASTOS',                      'GASTO',      'grupo'),
  ('5.1',        'COSTOS DIRECTOS',                      'GASTO',      'operacional'),
  ('5.1.01',     'Insumos y Materiales Clínicos',        'GASTO',      'operacional'),
  ('5.1.02',     'Honorarios Laboratorios Dentales',     'GASTO',      'operacional'),
  ('5.1.03',     'Honorarios Odontólogos Asociados',     'GASTO',      'operacional'),
  ('5.1.04',     'Honorarios Profesores y Expositores',  'GASTO',      'operacional'),
  ('5.1.05',     'Materiales y Limpieza (Cursos/Coworking)','GASTO',   'operacional'),
  ('5.2',        'GASTOS OPERATIVOS',                    'GASTO',      'administrativo'),
  ('5.2.01',     'Sueldos, Salarios y Beneficios',       'GASTO',      'administrativo'),
  ('5.2.02',     'Arriendo del Local / Consultorio',     'GASTO',      'administrativo'),
  ('5.2.03',     'Servicios Básicos (Luz, Agua, Internet)','GASTO',    'administrativo'),
  ('5.2.04',     'Mantenimiento Equipos e Instalaciones','GASTO',      'administrativo'),
  ('5.2.05',     'Suministros Oficina y Aseo',           'GASTO',      'administrativo'),
  ('5.2.06',     'Publicidad, Marketing y Comisiones',   'GASTO',      'administrativo'),
  ('5.2.07',     'Honorarios Externos (Contabilidad)',   'GASTO',      'administrativo'),
  ('5.2.08',     'Depreciaciones',                       'GASTO',      'administrativo'),
  ('5.2.09',     'Impuestos, Tasas y Otros Gastos',      'GASTO',      'administrativo')
on conflict (code) do update set 
  name = excluded.name, 
  type = excluded.type, 
  subtype = excluded.subtype;

