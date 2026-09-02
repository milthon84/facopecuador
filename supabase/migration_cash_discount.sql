-- =====================================================
-- MIGRACIÓN: Configuración de descuento por pago al contado / transferencia
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

ALTER TABLE public.sri_configs
  ADD COLUMN IF NOT EXISTS cash_discount_percent numeric(5,2) not null default 6.00;
