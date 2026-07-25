-- =====================================================
-- MIGRACIÓN: FOTOS E IMÁGENES DE PACIENTES
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- 1) TABLA: patient_photos
CREATE TABLE IF NOT EXISTS public.patient_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                         -- Asunto / Título de la foto
  image_url TEXT NOT NULL,                     -- URL pública de acceso a la imagen
  storage_path TEXT NOT NULL,                  -- Ruta interna en Supabase Storage
  notes TEXT,                                  -- Observaciones clínicas o notas opcionales
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para optimizar búsquedas por paciente
CREATE INDEX IF NOT EXISTS idx_patient_photos_patient_id ON public.patient_photos(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_photos_created_at ON public.patient_photos(created_at DESC);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_patient_photos_updated_at ON public.patient_photos;
CREATE TRIGGER trg_patient_photos_updated_at
  BEFORE UPDATE ON public.patient_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) CONFIGURACIÓN DE SEGURIDAD (RLS)
ALTER TABLE public.patient_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_patient_photos ON public.patient_photos;
CREATE POLICY admin_all_patient_photos ON public.patient_photos
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3) CREAR BUCKET DE ALMACENAMIENTO PARA FOTOS DE PACIENTES (Si no existe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-photos', 'patient-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acceso al bucket storage
DROP POLICY IF EXISTS "Acceso público de lectura a fotos de pacientes" ON storage.objects;
CREATE POLICY "Acceso público de lectura a fotos de pacientes"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'patient-photos');

DROP POLICY IF EXISTS "Gestión de fotos de pacientes para usuarios autenticados" ON storage.objects;
CREATE POLICY "Gestión de fotos de pacientes para usuarios autenticados"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'patient-photos')
  WITH CHECK (bucket_id = 'patient-photos');
