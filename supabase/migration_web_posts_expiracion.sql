-- =====================================================
-- FECHA DE EXPIRACIÓN DE ARTÍCULOS (web_posts)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- 1. Agregar columna de fecha de expiración
alter table public.web_posts
  add column if not exists expires_at timestamptz;

-- 2. Rellenar artículos existentes sin expiración: creación + 2 meses
update public.web_posts
  set expires_at = created_at + interval '2 months'
  where expires_at is null;

-- 3. Valor por defecto para nuevos artículos que no especifiquen expiración
alter table public.web_posts
  alter column expires_at set default (now() + interval '2 months');
