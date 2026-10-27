-- =====================================================
-- MIGRACIÓN: Facturas Recibidas SRI y Detalle de Gastos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- 1. Asegurar tabla facturas_recibidas y sus columnas
CREATE TABLE IF NOT EXISTS public.facturas_recibidas (
  clave_acceso        TEXT PRIMARY KEY,
  ruc_emisor          TEXT,
  razon_social        TEXT,
  numero_comprobante  TEXT,
  fecha_emision       DATE,
  fecha_autorizacion  TEXT,
  subtotal            NUMERIC(12,2) DEFAULT 0.0,
  iva                 NUMERIC(12,2) DEFAULT 0.0,
  total               NUMERIC(12,2) DEFAULT 0.0,
  estado_facop        TEXT DEFAULT 'pendiente',
  expense_id          UUID,
  created_at          TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW())
);

-- Si la tabla ya fue creada por UI, asegurar columnas adicionales
ALTER TABLE public.facturas_recibidas
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS iva NUMERIC(12,2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS estado_facop TEXT DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW());

-- Índices para búsqueda rápida de facturas pendientes
CREATE INDEX IF NOT EXISTS idx_facturas_recibidas_estado ON public.facturas_recibidas (estado_facop);
CREATE INDEX IF NOT EXISTS idx_facturas_recibidas_ruc ON public.facturas_recibidas (ruc_emisor);
CREATE INDEX IF NOT EXISTS idx_facturas_recibidas_fecha ON public.facturas_recibidas (fecha_emision DESC);

-- 2. Vincular clave de acceso en la cabecera de expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS factura_recibida_clave_acceso TEXT REFERENCES public.facturas_recibidas(clave_acceso) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_clave_acceso ON public.expenses (factura_recibida_clave_acceso);

-- 3. Crear tabla de detalle de gastos (expense_items)
CREATE TABLE IF NOT EXISTS public.expense_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id   UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  quantity     NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price   NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  iva_rate     NUMERIC(5,2) NOT NULL DEFAULT 15, -- 0 o 15
  subtotal     NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_items_expense_id ON public.expense_items (expense_id);

-- 4. Permisos y RLS
ALTER TABLE public.facturas_recibidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.facturas_recibidas TO authenticated, service_role;
GRANT SELECT ON TABLE public.facturas_recibidas TO anon;

GRANT ALL ON TABLE public.expense_items TO authenticated, service_role;
GRANT SELECT ON TABLE public.expense_items TO anon;

DROP POLICY IF EXISTS "facturas_recibidas_auth_all" ON public.facturas_recibidas;
CREATE POLICY "facturas_recibidas_auth_all"
  ON public.facturas_recibidas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "expense_items_auth_all" ON public.expense_items;
CREATE POLICY "expense_items_auth_all"
  ON public.expense_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Recargar la caché de PostgREST para que la API detecte las tablas inmediatamente
NOTIFY pgrst, 'reload schema';
