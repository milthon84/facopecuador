-- =====================================================
-- MIGRACIÓN: Agregar columna authorization_number a expenses
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- 1. Agregar la columna authorization_number en public.expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS authorization_number TEXT;

-- 2. Índice para consultas rápidas por número de autorización o clave SRI
CREATE INDEX IF NOT EXISTS idx_expenses_authorization_number
  ON public.expenses (authorization_number);

COMMENT ON COLUMN public.expenses.authorization_number IS 'Número de autorización física o clave de acceso SRI de 49 dígitos del comprobante';

-- 3. Poblar authorization_number desde factura_recibida_clave_acceso o notas si existen
UPDATE public.expenses
SET authorization_number = factura_recibida_clave_acceso
WHERE authorization_number IS NULL
  AND factura_recibida_clave_acceso IS NOT NULL;

-- 4. Extraer claves o autorizaciones desde notas si estuvieran etiquetadas
UPDATE public.expenses
SET authorization_number = substring(notes from '\[AUT:([A-Za-z0-9_-]+)\]')
WHERE authorization_number IS NULL
  AND notes ~ '\[AUT:([A-Za-z0-9_-]+)\]';
