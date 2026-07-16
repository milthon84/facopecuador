-- =====================================================
-- MIGRACIÓN: FORZAR CAMBIO DE CONTRASEÑA EN PRÓXIMO INICIO DE SESIÓN
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- Agregar la columna require_password_change a public.user_profiles
alter table public.user_profiles
add column if not exists require_password_change boolean not null default false;
