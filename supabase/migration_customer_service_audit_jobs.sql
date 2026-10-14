-- ==============================================================================
-- MIGRACIÓN: JOBS DE AUDITORÍA POR LOTES (SEGUNDO PLANO) PARA ATENCIÓN AL CLIENTE
-- Requiere: migration_customer_service_audit.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.customer_service_audit_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (status IN ('pendiente', 'en_proceso', 'completado', 'error')),
    period_label TEXT NOT NULL,
    period_type TEXT NOT NULL DEFAULT 'mensual',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_chats INTEGER NOT NULL DEFAULT 0,
    batch_size INTEGER NOT NULL DEFAULT 10,
    batches_total INTEGER NOT NULL DEFAULT 0,
    batches_done INTEGER NOT NULL DEFAULT 0,
    chats_payload JSONB NOT NULL DEFAULT '[]'::jsonb,      -- chats del periodo ya agrupados (transcripciones completas)
    batch_results JSONB NOT NULL DEFAULT '[]'::jsonb,      -- resultado parcial por lote
    model_used TEXT,
    audit_id UUID REFERENCES public.customer_service_audits(id) ON DELETE SET NULL,
    error_message TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_audit_jobs_status ON public.customer_service_audit_jobs(status);
CREATE INDEX IF NOT EXISTS idx_cs_audit_jobs_created_at ON public.customer_service_audit_jobs(created_at DESC);

ALTER TABLE public.customer_service_audit_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'customer_service_audit_jobs' AND policyname = 'cs_audit_jobs_full_access'
    ) THEN
        CREATE POLICY cs_audit_jobs_full_access ON public.customer_service_audit_jobs FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
