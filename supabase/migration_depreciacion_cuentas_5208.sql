-- Migration: Subcuentas de movimiento para Depreciación (5.2.08) y Depreciación Acumulada (1.2.02)
-- Asegura que los asientos contables de depreciación imputen a cuentas de movimiento de último nivel

INSERT INTO public.accounts (code, name, type, subtype, parent_code, active, is_movement)
VALUES
  ('5.2.08.01', 'Depreciación Equipos Médicos y Odontológicos',   'GASTO',  'administrativo', '5.2.08', true, true),
  ('5.2.08.02', 'Depreciación Mobiliario y Enseres',               'GASTO',  'administrativo', '5.2.08', true, true),
  ('5.2.08.03', 'Depreciación Equipos de Computación y Software',  'GASTO',  'administrativo', '5.2.08', true, true),
  ('5.2.08.04', 'Depreciación Inmuebles e Instalaciones',         'GASTO',  'administrativo', '5.2.08', true, true),
  ('5.2.08.05', 'Depreciación Vehículos y Equipos de Transporte', 'GASTO',  'administrativo', '5.2.08', true, true),
  ('1.2.02.04', 'Deprec. Acum. Inmuebles',                         'ACTIVO', 'no_corriente',   '1.2.02',  true, true),
  ('1.2.02.05', 'Deprec. Acum. Vehículos',                         'ACTIVO', 'no_corriente',   '1.2.02',  true, true)
ON CONFLICT (code) DO UPDATE
SET is_movement = true,
    active = true,
    name = EXCLUDED.name;

-- Corregir líneas de diario históricas que hayan imputado a la cuenta cabecera 5.2.08
UPDATE public.journal_lines
SET account_code = '5.2.08.01',
    account_name = 'Depreciación Equipos Médicos y Odontológicos'
WHERE account_code = '5.2.08';
