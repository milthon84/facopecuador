-- =====================================================================================
-- MIGRACIÓN: Código Secuencial de Activos Fijos y Vinculación con Gastos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================================================

ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS account_code text,
  ADD COLUMN IF NOT EXISTS expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_code ON public.fixed_assets (code);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_expense_id ON public.fixed_assets (expense_id);
