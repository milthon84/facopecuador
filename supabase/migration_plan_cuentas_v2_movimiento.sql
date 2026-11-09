-- =====================================================================================
-- MIGRACIÓN: Plan de Cuentas v2 — Corrección Contable NIIF
-- Objetivo  : Garantizar que todos los asientos contables apunten únicamente a
--             cuentas de MOVIMIENTO (hijas), nunca a cuentas de GRUPO.
-- Ejecutar  : Supabase Dashboard → SQL Editor → Ejecutar completo
-- Autor     : Generado por sistema FACOP
-- Fecha     : 2026-11-08
-- =====================================================================================

-- ─── BLOQUE 1: AGREGAR COLUMNA is_movement ────────────────────────────────────────
-- Permite distinguir programáticamente grupos de movimientos en la capa de aplicación.
alter table public.accounts
  add column if not exists is_movement boolean not null default false;

-- Marcar las cuentas actuales que ya son de movimiento (4 segmentos de código)
update public.accounts
set is_movement = true
where code ~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]'   -- Tiene al menos 4 niveles
   or code in (
     '1.2.01.99',                                  -- Depreciación Acumulada PPE (movimiento legado)
     '4.1.01.01','4.1.01.02',
     '5.1.01.01','5.1.01.02'
   );

-- ─── BLOQUE 2: ACTUALIZAR NOMBRES DE CUENTAS DE GRUPO ────────────────────────────
update public.accounts set name = 'Honorarios Profesionales'
  where code = '5.1.02';

update public.accounts set name = 'Agua, Energía, Luz y Comunicaciones'
  where code = '5.2.03';

update public.accounts set name = 'Honorarios Externos'
  where code = '5.2.07';

update public.accounts set name = 'Impuestos, Tasas, Contribuciones'
  where code = '5.2.09';

-- ─── BLOQUE 3: DESACTIVAR CUENTAS INCORRECTAMENTE CREADAS BAJO 5.2.02 ───────────
-- Estas cuentas fueron colocadas en el subgrupo de "Arriendo" por error.
-- Se desactivan para evitar nuevos asientos; 5.2.02.02 se conserva y renombra a "Arriendo para Eventos".
update public.accounts set active = false
  where code in ('5.2.02.03','5.2.02.04','5.2.02.05','5.2.02.06','5.2.02.99');

update public.accounts set name = 'Arriendo para Eventos', is_movement = true, active = true
  where code = '5.2.02.02';

-- ─── BLOQUE 4: INSERTAR NUEVAS CUENTAS DE MOVIMIENTO ────────────────────────────
insert into public.accounts (code, name, type, subtype, is_movement) values

  -- 5.1.02 Honorarios Profesionales → hijas
  ('5.1.02.01', 'Honorarios Laboratorios Dentales',  'GASTO', 'operacional', true),
  ('5.1.02.02', 'Honorarios Odontólogos Asociados',  'GASTO', 'operacional', true),
  ('5.1.02.03', 'Honorarios Profesores y Expositores','GASTO','operacional', true),
  ('5.1.02.04', 'Honorarios Otros Profesionales',    'GASTO', 'operacional', true),

  -- 5.2.03 Agua, Energía, Luz y Comunicaciones → hijas
  ('5.2.03.01', 'Energía Eléctrica',                 'GASTO', 'administrativo', true),
  ('5.2.03.02', 'Agua Potable',                      'GASTO', 'administrativo', true),
  ('5.2.03.03', 'Internet',                          'GASTO', 'administrativo', true),
  ('5.2.03.04', 'Datafast',                          'GASTO', 'administrativo', true),

  -- 5.2.04 Mantenimiento Equipos e Instalaciones → hijas
  ('5.2.04.01', 'Mantenimiento Instalaciones/Adecuaciones','GASTO','administrativo', true),

  -- 5.2.05 Suministros Oficina y Aseo → hijas
  ('5.2.05.01', 'Útiles de Oficina',                 'GASTO', 'administrativo', true),
  ('5.2.05.02', 'Útiles de Aseo',                    'GASTO', 'administrativo', true),
  ('5.2.05.03', 'Suministros de Oficina',             'GASTO', 'administrativo', true),

  -- 5.2.07 Honorarios Externos → hijas
  ('5.2.07.01', 'Honorarios Externos (Contabilidad)','GASTO', 'administrativo', true),

  -- 5.2.09 Impuestos, Tasas, Contribuciones → hijas
  ('5.2.09.01', 'Patente',                           'GASTO', 'administrativo', true),
  ('5.2.09.02', '1.5 por Mil',                       'GASTO', 'administrativo', true),
  ('5.2.09.03', 'Contribuciones',                    'GASTO', 'administrativo', true),
  ('5.2.09.04', 'Permiso de Funcionamiento',         'GASTO', 'administrativo', true),

  -- 5.2.10 Seguros → nuevo grupo + hija
  ('5.2.10',    'Seguros',                            'GASTO', 'administrativo', false),
  ('5.2.10.01', 'Seguro',                            'GASTO', 'administrativo', true),

  -- 5.2.11 Gastos de Viaje → nuevo grupo + hijas
  ('5.2.11',    'Gastos de Viaje',                   'GASTO', 'administrativo', false),
  ('5.2.11.01', 'Hospedaje',                         'GASTO', 'administrativo', true),
  ('5.2.11.02', 'Alimentación Viaje',                'GASTO', 'administrativo', true),
  ('5.2.11.03', 'Movilización Viaje',                'GASTO', 'administrativo', true),

  -- 5.2.19 Otros Gastos → nuevo grupo + hija
  ('5.2.19',    'Otros Gastos',                      'GASTO', 'administrativo', false),
  ('5.2.19.01', 'Alimentación Cafetería',            'GASTO', 'administrativo', true),

  -- 5.4 Gastos Financieros → nuevo grupo de nivel 2 + nivel 3 + movimiento
  ('5.4',       'GASTOS FINANCIEROS',                'GASTO', 'financiero',     false),
  ('5.4.01',    'Gastos Bancarios',                  'GASTO', 'financiero',     false),
  ('5.4.01.01', 'Comisiones Bancarias',              'GASTO', 'financiero',     true)

on conflict (code) do update set
  name       = excluded.name,
  type       = excluded.type,
  subtype    = excluded.subtype,
  is_movement = excluded.is_movement;

-- ─── BLOQUE 5: RECLASIFICACIÓN DE ASIENTOS HISTÓRICOS ────────────────────────────
-- Se reclasifican las 6 líneas de journal_lines que tenían cuentas de GRUPO.
-- Criterio de mapeo:
--   4.1.01  "Servicios de Prevención e Higiene" (GRUPO)  → 4.1.01.01 "Servicios Odontológicos" (MOV)
--   5.1.01  "Insumos y Materiales Clínicos"     (GRUPO)  → 5.1.01.01 "Insumos Dentales Utilizados" (MOV)
--   5.2.04  "Mantenimiento Equipos e Instalaciones"(GRUPO)→ 5.2.04.01 "Mantenimiento Instalaciones/Adecuaciones" (MOV)

-- Reclasificar líneas de Ingresos en Facturas de Venta (4.1.01 → 4.1.01.01)
update public.journal_lines
set
  account_code = '4.1.01.01',
  account_name = 'Servicios Odontológicos',
  description  = coalesce(description, '') ||
                 ' [Reclasificado de 4.1.01 → 4.1.01.01 el 2026-11-08]'
where account_code = '4.1.01'
  and id in (
    '0d09c313-ee6f-49f2-aa80-2deb9d7ac7c3',
    '60b54dc3-64d2-4626-b827-349b5fbd4779',
    'af56e14e-ba59-4d05-8b6c-7da471a88faf'
  );

-- Reclasificar líneas de Gastos Clínicos (5.1.01 → 5.1.01.01)
update public.journal_lines
set
  account_code = '5.1.01.01',
  account_name = 'Insumos Dentales Utilizados',
  description  = coalesce(description, '') ||
                 ' [Reclasificado de 5.1.01 → 5.1.01.01 el 2026-11-08]'
where account_code = '5.1.01'
  and id in (
    '452e06d8-9c16-4505-b2d4-e11e9946e322',
    '9c1357fe-eebb-40ed-8169-19fc1b54f782'
  );

-- Reclasificar línea de Mantenimiento (5.2.04 → 5.2.04.01)
update public.journal_lines
set
  account_code = '5.2.04.01',
  account_name = 'Mantenimiento Instalaciones/Adecuaciones',
  description  = coalesce(description, '') ||
                 ' [Reclasificado de 5.2.04 → 5.2.04.01 el 2026-11-08]'
where account_code = '5.2.04'
  and id in (
    'adbf153b-bc49-482b-b584-523852a96c8f'
  );

-- ─── BLOQUE 5B: CORRECCIÓN — Suministros de Oficina 5.2.05.03 ───────────────────
-- Esta cuenta faltó en la versión inicial porque el plan original tenía código duplicado
-- (5.2.05.02 asignado tanto a "Útiles de Aseo" como a "Suministros de Oficina").
-- El código correcto es 5.2.05.03.
insert into public.accounts (code, name, type, subtype, is_movement) values
  ('5.2.05.03', 'Suministros de Oficina', 'GASTO', 'administrativo', true)
on conflict (code) do update set
  name        = excluded.name,
  type        = excluded.type,
  subtype     = excluded.subtype,
  is_movement = excluded.is_movement;

-- ─── BLOQUE 6: VERIFICACIÓN FINAL ───────────────────────────────────────────────
-- Ejecuta estas consultas después del script para confirmar que no quedan líneas en grupos.

-- Verificar que no hay más líneas en cuentas de grupo de gasto/ingreso:
-- (Deben devolver 0 registros)
select jl.id, jl.account_code, jl.account_name, jl.debit, jl.credit,
       je.entry_date, je.description as asiento
from public.journal_lines jl
join public.journal_entries je on je.id = jl.journal_entry_id
where jl.account_code in ('4.1.01','5.1.01','5.1.02','5.1.03','5.1.04',
                           '5.2.01','5.2.02','5.2.03','5.2.04','5.2.05',
                           '5.2.06','5.2.07','5.2.08','5.2.09')
  and je.status = 'posted'
order by je.entry_date;

-- Verificar que las nuevas cuentas de movimiento existen:
select code, name, type, subtype, is_movement, active
from public.accounts
where code like '5.1.02.%'
   or code like '5.2.03.%'
   or code like '5.2.04.%'
   or code like '5.2.05.%'
   or code like '5.2.07.%'
   or code like '5.2.09.%'
   or code like '5.2.10%'
   or code like '5.2.11%'
   or code like '5.2.19%'
   or code like '5.4%'
order by code;
