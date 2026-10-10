-- ==============================================================================
-- MIGRACIÓN: AUDITORÍA DE ATENCIÓN AL CLIENTE CON INTELIGENCIA ARTIFICIAL
-- ==============================================================================

-- 1. Tabla de Chats de Atención al Cliente (WhatsApp / Canales de Soporte)
CREATE TABLE IF NOT EXISTS public.customer_service_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_name TEXT,
    phone TEXT,
    agent_name TEXT DEFAULT 'Recepción / Asesor',
    channel TEXT DEFAULT 'whatsapp',
    chat_date DATE DEFAULT CURRENT_DATE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    messages_count INTEGER DEFAULT 0,
    transcript TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar búsquedas por rango de fecha y teléfono
CREATE INDEX IF NOT EXISTS idx_cs_chats_chat_date ON public.customer_service_chats(chat_date);
CREATE INDEX IF NOT EXISTS idx_cs_chats_phone ON public.customer_service_chats(phone);
CREATE INDEX IF NOT EXISTS idx_cs_chats_created_at ON public.customer_service_chats(created_at);

-- 2. Tabla de Auditorías y Evaluaciones de IA
CREATE TABLE IF NOT EXISTS public.customer_service_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_label TEXT NOT NULL,
    period_type TEXT NOT NULL DEFAULT 'mensual', -- 'semanal', 'quincenal', 'mensual', 'custom'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_chats_analyzed INTEGER DEFAULT 0,
    overall_score NUMERIC(4, 1) DEFAULT 0, -- Escala 0 a 100
    cordiality_score NUMERIC(4, 1) DEFAULT 0, -- Escala 0 a 10
    speed_score NUMERIC(4, 1) DEFAULT 0, -- Escala 0 a 10
    resolution_score NUMERIC(4, 1) DEFAULT 0, -- Escala 0 a 10
    rejected_leads_count INTEGER DEFAULT 0,
    slow_response_count INTEGER DEFAULT 0,
    executive_summary TEXT,
    strengths JSONB DEFAULT '[]'::jsonb,
    weaknesses JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    chat_evaluations JSONB DEFAULT '[]'::jsonb,
    model_used TEXT DEFAULT 'claude-3-5-sonnet',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_audits_dates ON public.customer_service_audits(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_cs_audits_created_at ON public.customer_service_audits(created_at DESC);

-- Habilitar RLS si aplica
ALTER TABLE public.customer_service_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_service_audits ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para usuarios autenticados / servicio backend
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'customer_service_chats' AND policyname = 'cs_chats_full_access'
    ) THEN
        CREATE POLICY cs_chats_full_access ON public.customer_service_chats FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'customer_service_audits' AND policyname = 'cs_audits_full_access'
    ) THEN
        CREATE POLICY cs_audits_full_access ON public.customer_service_audits FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
