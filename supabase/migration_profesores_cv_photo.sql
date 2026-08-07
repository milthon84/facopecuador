-- =====================================================
-- MIGRACIÓN: HOJA DE VIDA (CV) Y FOTO OPCIONAL EN PROFESORES
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

alter table public.profesores
add column if not exists cv_url text,
add column if not exists photo_url text;
