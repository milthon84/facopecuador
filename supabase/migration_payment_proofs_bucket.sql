-- =====================================================
-- MIGRACIÓN: BUCKET STORAGE PARA COMPROBANTES DE GASTOS Y PAGOS (payment-proofs)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- 1. Crear o actualizar bucket payment-proofs asegurando que sea público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,
  10485760, -- 10 MB límite
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];

-- 2. Políticas de acceso RLS en storage.objects
-- Lectura pública para visualización de comprobantes
DROP POLICY IF EXISTS "Acceso público lectura comprobantes" ON storage.objects;
CREATE POLICY "Acceso público lectura comprobantes"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'payment-proofs');

-- Subida y administración para usuarios autenticados
DROP POLICY IF EXISTS "Gestión comprobantes usuarios autenticados" ON storage.objects;
CREATE POLICY "Gestión comprobantes usuarios autenticados"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'payment-proofs')
  WITH CHECK (bucket_id = 'payment-proofs');
