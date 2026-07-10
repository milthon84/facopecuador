-- =====================================================
-- CATEGORIZACIÓN DE ARTÍCULOS POR DESTINO (web_posts)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- 1. Agregar columna de destino/categoría del artículo
alter table public.web_posts
  add column if not exists category text not null default 'clinica';

-- 2. Restringir los valores permitidos a las 3 secciones del sitio
alter table public.web_posts
  drop constraint if exists web_posts_category_check;

alter table public.web_posts
  add constraint web_posts_category_check check (category in ('cursos', 'clinica', 'coworking'));
