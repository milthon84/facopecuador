-- =====================================================
-- MIGRACIÓN: Cuentas Contables NIIF - Préstamos Accionistas
-- =====================================================

INSERT INTO public.accounts (code, name, type, subtype, parent_code, active, is_movement)
VALUES
  ('2.1.05', 'PRÉSTAMOS ACCIONISTAS', 'PASIVO', 'corriente', '2.1', true, false),
  ('2.1.05.01', 'Préstamos Accionistas por Pagar', 'PASIVO', 'corriente', '2.1.05', true, true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  subtype = EXCLUDED.subtype,
  parent_code = EXCLUDED.parent_code,
  active = EXCLUDED.active,
  is_movement = EXCLUDED.is_movement;
