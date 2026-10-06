-- =====================================================
-- MIGRACIÓN: ASIGNACIÓN DE DOCTOR A CITAS
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- 1. Agregar columna doctor_id a appointments vinculada a profesores
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES public.profesores(id) ON DELETE SET NULL;

-- 2. Índice para acelerar búsquedas y filtros por doctor
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON public.appointments(doctor_id);
