-- =====================================================
-- MIGRACIÓN: MÓDULO DE ALQUILER Y COWORKING
-- Recursos: Puesto de trabajo, Clínica completa, Aula pequeña, Aula grande
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

CREATE TABLE IF NOT EXISTS public.coworking_rentals (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Tipo de recurso
  resource_type               TEXT NOT NULL CHECK (resource_type IN ('puesto_trabajo', 'clinica_completa', 'aula_pequena', 'aula_grande')),
  resource_identifier         TEXT, -- e.g. "Sillón 1", "Box 2", "Aula B"

  -- Fechas y horario
  rental_date                 DATE NOT NULL,
  start_time                  TIME NOT NULL,
  end_time                    TIME NOT NULL,
  hours                       NUMERIC(5,2) DEFAULT 1.0,

  -- Estado de la reserva
  status                      TEXT NOT NULL DEFAULT 'reservado'
                              CHECK (status IN ('reservado', 'en_curso', 'finalizado', 'facturado', 'cancelado')),

  -- Datos del doctor / arrendatario
  doctor_name                 TEXT NOT NULL,
  doctor_document             TEXT, -- Cédula o RUC
  doctor_email                TEXT,
  doctor_phone                TEXT,
  doctor_specialty            TEXT,
  doctor_registration_number  TEXT, -- Registro MSP / Senescyt
  doctor_id                   UUID REFERENCES public.profesores(id) ON DELETE SET NULL,

  -- Datos del paciente atendido (opcional)
  patient_name                TEXT,
  patient_document            TEXT,
  patient_id                  UUID REFERENCES public.patients(id) ON DELETE SET NULL,

  -- Documentos de respaldo (contrato y descargo de responsabilidad)
  contract_url                TEXT, -- URL de archivo PDF o imagen del contrato
  contract_uploaded_at        TIMESTAMPTZ,
  waiver_url                  TEXT, -- URL de archivo PDF o imagen del descargo de responsabilidad del paciente
  waiver_uploaded_at          TIMESTAMPTZ,

  -- Tarifas y facturación
  rate_type                   TEXT DEFAULT 'hora' CHECK (rate_type IN ('hora', 'turno', 'dia', 'evento')),
  hourly_rate                 NUMERIC(10,2) DEFAULT 0.00,
  total_price                 NUMERIC(10,2) NOT NULL DEFAULT 0.00,

  -- Anticipo
  deposit_amount              NUMERIC(10,2) DEFAULT 0.00,
  deposit_payment_method      TEXT, -- 'efectivo', 'transferencia', 'tarjeta_credito', etc.
  deposit_notes               TEXT, -- referencia bancaria o notas del anticipo

  invoice_id                  UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  invoice_number              TEXT,

  -- Observaciones
  notes                       TEXT,

  -- Auditoría
  created_by_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email            TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_coworking_date ON public.coworking_rentals (rental_date DESC);
CREATE INDEX IF NOT EXISTS idx_coworking_resource ON public.coworking_rentals (resource_type);
CREATE INDEX IF NOT EXISTS idx_coworking_status ON public.coworking_rentals (status);
CREATE INDEX IF NOT EXISTS idx_coworking_doctor_doc ON public.coworking_rentals (doctor_document);
CREATE INDEX IF NOT EXISTS idx_coworking_invoice_id ON public.coworking_rentals (invoice_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_coworking_updated_at ON public.coworking_rentals;
CREATE TRIGGER trg_coworking_updated_at
  BEFORE UPDATE ON public.coworking_rentals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS y permisos
ALTER TABLE public.coworking_rentals ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.coworking_rentals TO authenticated, service_role;
GRANT SELECT ON TABLE public.coworking_rentals TO anon;

DROP POLICY IF EXISTS "coworking_rentals_authenticated_all" ON public.coworking_rentals;
CREATE POLICY "coworking_rentals_authenticated_all"
  ON public.coworking_rentals FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Idempotencia para tablas ya creadas:
ALTER TABLE public.coworking_rentals
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS deposit_payment_method TEXT,
  ADD COLUMN IF NOT EXISTS deposit_notes TEXT;

-- Notificar a PostgREST para recargar la caché de esquema
NOTIFY pgrst, 'reload schema';
