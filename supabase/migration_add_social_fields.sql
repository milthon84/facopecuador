-- =====================================================
-- AGREGAR COLUMNAS PARA INTEGRACIÓN CON REDES SOCIALES
-- =====================================================

ALTER TABLE public.web_posts
ADD COLUMN IF NOT EXISTS facebook_post_id TEXT,
ADD COLUMN IF NOT EXISTS instagram_post_id TEXT;
