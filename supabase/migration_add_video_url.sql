-- =====================================================
-- AGREGAR COLUMNA PARA SOPORTE DE VIDEO EN ARTÍCULOS
-- =====================================================

ALTER TABLE public.web_posts
ADD COLUMN IF NOT EXISTS video_url TEXT;
