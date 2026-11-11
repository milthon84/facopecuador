-- =====================================================
-- MIGRACIÓN: RESPALDOS Y DOCUMENTOS DE DECLARACIONES TRIBUTARIAS SRI
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- 1) TABLA: tax_declaration_documents
CREATE TABLE IF NOT EXISTS public.tax_declaration_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period TEXT NOT NULL,                             -- Formato 'YYYY-MM' ej. '2026-11'
  year INTEGER NOT NULL,                            -- Ej: 2026
  month INTEGER NOT NULL,                           -- 1 a 12
  document_type TEXT NOT NULL DEFAULT 'iva_104',    -- 'iva_104' | 'retenciones_103' | 'pago_sri' | 'ats' | 'renta_101' | 'retenciones_recibidas' | 'otro'
  title TEXT NOT NULL,                             -- Descripción / Título del documento
  file_url TEXT NOT NULL,                          -- URL de acceso al documento
  storage_path TEXT NOT NULL,                      -- Ruta interna en Supabase Storage
  file_name TEXT NOT NULL,                         -- Nombre original del archivo (ej. Formulario_104_Nov2026.pdf)
  file_type TEXT,                                  -- Tipo MIME (ej. application/pdf, image/jpeg, application/zip, text/xml)
  file_size BIGINT,                                -- Tamaño en bytes
  notes TEXT,                                      -- Notas u observaciones del contador
  uploaded_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de optimización
CREATE INDEX IF NOT EXISTS idx_tax_declaration_docs_period ON public.tax_declaration_documents(period);
CREATE INDEX IF NOT EXISTS idx_tax_declaration_docs_year_month ON public.tax_declaration_documents(year, month);
CREATE INDEX IF NOT EXISTS idx_tax_declaration_docs_doc_type ON public.tax_declaration_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_tax_declaration_docs_created_at ON public.tax_declaration_documents(created_at DESC);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_tax_declaration_docs_updated_at ON public.tax_declaration_documents;
CREATE TRIGGER trg_tax_declaration_docs_updated_at
  BEFORE UPDATE ON public.tax_declaration_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) POLÍTICAS DE SEGURIDAD (RLS)
ALTER TABLE public.tax_declaration_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth tax_declaration_documents" ON public.tax_declaration_documents;
CREATE POLICY "Auth tax_declaration_documents" ON public.tax_declaration_documents
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3) BUCKET DE ALMACENAMIENTO (tax-declarations)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tax-declarations',
  'tax-declarations',
  true,
  26214400, -- 25 MB máximo
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/zip',
    'application/x-zip-compressed',
    'application/xml',
    'text/xml',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 26214400;

-- Políticas de acceso para el bucket tax-declarations
DROP POLICY IF EXISTS "Acceso público lectura declaraciones" ON storage.objects;
CREATE POLICY "Acceso público lectura declaraciones"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'tax-declarations');

DROP POLICY IF EXISTS "Gestión declaraciones usuarios autenticados" ON storage.objects;
CREATE POLICY "Gestión declaraciones usuarios autenticados"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'tax-declarations')
  WITH CHECK (bucket_id = 'tax-declarations');
