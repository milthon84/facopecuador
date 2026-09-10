-- =====================================================
-- MIGRACIÓN: AGREGAR DESCUENTO A SERVICIOS
-- =====================================================

ALTER TABLE public.services 
ADD COLUMN discount_percent numeric(5,2) not null default 0;

-- Optionally, add a constraint to ensure discount is between 0 and 100
ALTER TABLE public.services
ADD CONSTRAINT check_discount_percent CHECK (discount_percent >= 0 AND discount_percent <= 100);
