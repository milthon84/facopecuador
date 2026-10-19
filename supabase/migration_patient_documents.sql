-- =====================================================
-- MIGRACIÓN: CONSENTIMIENTOS Y DOCUMENTOS DE PACIENTES
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- 1) TABLA: patient_documents
CREATE TABLE IF NOT EXISTS public.patient_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                             -- Asunto / Título del documento
  category TEXT NOT NULL DEFAULT 'consentimiento', -- 'consentimiento' | 'identificacion' | 'historia' | 'examen' | 'otro'
  file_url TEXT NOT NULL,                          -- URL pública de acceso al documento
  storage_path TEXT NOT NULL,                      -- Ruta interna en Supabase Storage
  file_name TEXT,                                  -- Nombre original del archivo (ej. consentimiento_firmado.pdf)
  file_type TEXT,                                  -- Tipo MIME (ej. application/pdf, image/jpeg, etc.)
  file_size BIGINT,                                -- Tamaño en bytes
  notes TEXT,                                      -- Observaciones o notas opcionales
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para optimizar búsquedas por paciente y fecha
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON public.patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_category ON public.patient_documents(category);
CREATE INDEX IF NOT EXISTS idx_patient_documents_created_at ON public.patient_documents(created_at DESC);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_patient_documents_updated_at ON public.patient_documents;
CREATE TRIGGER trg_patient_documents_updated_at
  BEFORE UPDATE ON public.patient_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) CONFIGURACIÓN DE SEGURIDAD (RLS)
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_patient_documents ON public.patient_documents;
CREATE POLICY admin_all_patient_documents ON public.patient_documents
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3) CREAR BUCKET DE ALMACENAMIENTO PARA DOCUMENTOS (Si no existe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-documents', 'patient-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acceso al bucket storage
DROP POLICY IF EXISTS "Acceso público de lectura a documentos de pacientes" ON storage.objects;
CREATE POLICY "Acceso público de lectura a documentos de pacientes"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'patient-documents');

DROP POLICY IF EXISTS "Gestión de documentos de pacientes para usuarios autenticados" ON storage.objects;
CREATE POLICY "Gestión de documentos de pacientes para usuarios autenticados"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'patient-documents')
  WITH CHECK (bucket_id = 'patient-documents');
