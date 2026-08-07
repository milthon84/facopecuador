-- =====================================================
-- MIGRACIÓN: FOTO OPCIONAL EN ALUMNOS
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

alter table public.alumnos
add column if not exists photo_url text;
