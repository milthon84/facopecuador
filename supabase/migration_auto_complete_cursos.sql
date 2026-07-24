-- =====================================================
-- MIGRACIÓN: Función para auto-completar cursos expirados
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- Crear o reemplazar la función
CREATE OR REPLACE FUNCTION public.auto_complete_expired_cursos()
RETURNS void AS $$
BEGIN
  UPDATE public.cursos
  SET status = 'completed'
  WHERE status = 'active'
    AND end_date < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guayaquil')::date;
END;
$$ LANGUAGE plpgsql;
