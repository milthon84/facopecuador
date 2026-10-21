-- =====================================================
-- MIGRACIÓN: Soporte de Respaldo / Comprobante Digital en Gastos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS receipt_url text;

CREATE INDEX IF NOT EXISTS idx_expenses_receipt_url ON public.expenses (receipt_url);

COMMENT ON COLUMN public.expenses.receipt_url IS 'URL pública o ruta del archivo de respaldo (factura electrónica PDF, comprobante o foto de recibo)';
