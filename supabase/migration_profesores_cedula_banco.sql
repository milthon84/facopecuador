-- ==============================================================================
-- Migración: Cédula y Datos Bancarios para Especialistas / Profesores
-- ==============================================================================

-- 1. Agregar columnas para documento de identidad y datos bancarios
ALTER TABLE public.profesores 
ADD COLUMN IF NOT EXISTS document_number TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_type TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_account_owner TEXT,
ADD COLUMN IF NOT EXISTS bank_account_id TEXT;

-- 2. Índices para optimizar búsquedas por documento y cuenta
CREATE INDEX IF NOT EXISTS idx_profesores_document_number ON public.profesores(document_number);
CREATE INDEX IF NOT EXISTS idx_profesores_bank_account ON public.profesores(bank_account_number);
