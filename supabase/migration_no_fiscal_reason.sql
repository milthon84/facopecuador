-- Agregar campos de motivo y detalle para registros sin factura (Beca, Gratis, Otro Motivo)
ALTER TABLE public.curso_modulo_inscripciones
  ADD COLUMN IF NOT EXISTS no_fiscal_reason text,
  ADD COLUMN IF NOT EXISTS no_fiscal_detail text;

ALTER TABLE public.curso_inscripciones
  ADD COLUMN IF NOT EXISTS no_fiscal_reason text,
  ADD COLUMN IF NOT EXISTS no_fiscal_detail text;
