-- =====================================================
-- MIGRACIÓN: AÑADIR CAMPO 'AREA' A GASTOS (CLÍNICA VS CURSOS)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- 1. Añadir columna 'area' (valores: 'clinica', 'cursos', 'general')
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT 'clinica';

-- 2. Índice para acelerar filtros en Dashboard y Gastos
CREATE INDEX IF NOT EXISTS idx_expenses_area ON public.expenses (area);

-- 3. Actualizar automáticamente gastos existentes según descripción o categoría
UPDATE public.expenses
SET area = 'cursos'
WHERE area = 'clinica' 
  AND (
    lower(description) LIKE '%curso%' 
    OR lower(description) LIKE '%modulo%' 
    OR lower(description) LIKE '%módulo%' 
    OR lower(description) LIKE '%diplomado%'
    OR lower(category) LIKE '%curso%'
  );

COMMENT ON COLUMN public.expenses.area IS 'Destino del gasto: clinica (Clínica Dental), cursos (Educación Continua / Cursos), general (Administrativo / General)';
