-- =====================================================
-- MIGRACIÓN: Tabla para imágenes / comprobantes de facturas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS comprobante_url text,
  ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS comprobante_url text,
  ADD COLUMN IF NOT EXISTS comprobante_ref text;

-- Tabla para adjuntar imágenes a las facturas
CREATE TABLE IF NOT EXISTS public.invoice_photos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  title text NOT NULL,
  image_url text NOT NULL,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_photos_invoice ON public.invoice_photos(invoice_id);

ALTER TABLE public.invoice_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_invoice_photos ON public.invoice_photos;
CREATE POLICY admin_all_invoice_photos ON public.invoice_photos
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
