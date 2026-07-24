-- Migration: Create patient_quotations table for dental treatment budgets
CREATE TABLE IF NOT EXISTS patient_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  quotation_number VARCHAR(50) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'enviada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_email_at TIMESTAMPTZ,
  sent_whatsapp_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_patient_quotations_patient_id ON patient_quotations(patient_id);
