-- =====================================================================================
-- MIGRACIÓN: Plan de Cuentas v3 — Cuentas de Ingresos y Orígenes de Facturación
-- Objetivos:
--   1. Corregir y completar cuentas hijas de MOVIMIENTO bajo 4.2 (Academia), 4.3 (Coworking) y 4.4 (Otros Ingresos).
--   2. Agregar columna billing_area a invoices para clasificar el origen de la facturación.
-- =====================================================================================

-- 1. Agregar columna billing_area a invoices si no existe
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS billing_area text DEFAULT 'clinica';

-- 2. Asegurar que los grupos padres existan y estén marcados como NO movimiento
INSERT INTO public.accounts (code, name, type, subtype, is_movement, active)
VALUES
  ('4.2',    'INGRESOS ACADEMIA',                    'INGRESO', 'operacional', false, true),
  ('4.2.01', 'Cursos, Diplomados y Matrículas',      'INGRESO', 'operacional', false, true),
  ('4.3',    'INGRESOS COWORKING',                   'INGRESO', 'operacional', false, true),
  ('4.3.01', 'Alquiler de Aulas y Puestos de Trabajo','INGRESO', 'operacional', false, true),
  ('4.4',    'OTROS INGRESOS',                       'INGRESO', 'no_operacional', false, true),
  ('4.4.01', 'Intereses y Otros Ingresos',           'INGRESO', 'no_operacional', false, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  is_movement = false,
  active = true;

-- 3. Cuentas de MOVIMIENTO recomendadas para Ecuador (hijas con 4 segmentos)
INSERT INTO public.accounts (code, name, type, subtype, is_movement, active)
VALUES
  -- Academia / Capacitación (Operacional)
  ('4.2.01.01', 'Servicios de Capacitación y Cursos',               'INGRESO', 'operacional', true, true),
  ('4.2.01.02', 'Diplomados y Especializaciones',                   'INGRESO', 'operacional', true, true),

  -- Coworking / Alquiler de Instalaciones Odontológicas (Operacional)
  ('4.3.01.01', 'Alquiler de Espacios y Sillones Odontológicos',    'INGRESO', 'operacional', true, true),
  ('4.3.01.02', 'Alquiler de Aulas y Laboratorio',                  'INGRESO', 'operacional', true, true),

  -- Otros Ingresos (No Operacional)
  ('4.4.01.01', 'Otros Ingresos No Operacionales',                  'INGRESO', 'no_operacional', true, true),
  ('4.4.01.02', 'Intereses y Rendimientos Financieros',             'INGRESO', 'no_operacional', true, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  subtype = EXCLUDED.subtype,
  is_movement = true,
  active = true;

-- 4. Asegurar cuentas de Activo (Cuentas por Cobrar correspondientes)
INSERT INTO public.accounts (code, name, type, subtype, is_movement, active)
VALUES
  ('1.1.02.01', 'Cuentas por Cobrar Pacientes (Clínica)',            'ACTIVO', 'corriente', true, true),
  ('1.1.02.02', 'Cuentas por Cobrar Alumnos (Cursos)',               'ACTIVO', 'corriente', true, true),
  ('1.1.02.03', 'Cuentas por Cobrar Inquilinos (Coworking)',         'ACTIVO', 'corriente', true, true),
  ('1.1.02.04', 'Anticipos a Proveedores y Otras Ctas. por Cobrar',   'ACTIVO', 'corriente', true, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  is_movement = true,
  active = true;
