-- =====================================================
-- MIGRACIÓN: INTEGRACIÓN CON EWELINK / APERTURA DE PUERTA
-- Dispositivo: 1002906ff1 (Sonoff / eWeLink)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS public.door_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL DEFAULT '1002906ff1',
  device_name TEXT NOT NULL DEFAULT 'Puerta Principal',
  connection_mode TEXT NOT NULL DEFAULT 'webhook', -- 'webhook' | 'api'
  webhook_url TEXT,                                -- URL de Webhook de eWeLink Web o IFTTT
  app_id TEXT,                                     -- CoolKit App ID (si usa modo API)
  app_secret TEXT,                                 -- CoolKit App Secret (si usa modo API)
  email TEXT,                                      -- Cuenta eWeLink
  password TEXT,                                   -- Contraseña eWeLink
  region TEXT NOT NULL DEFAULT 'us',               -- 'us' | 'eu' | 'as' | 'cn'
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_close_seconds INT NOT NULL DEFAULT 3,       -- Segundos para enviar apagado si no tiene inching
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_door_settings_updated_at ON public.door_settings;
CREATE TRIGGER trg_door_settings_updated_at
  BEFORE UPDATE ON public.door_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Registro por defecto con el Device ID proporcionado (1002906ff1)
INSERT INTO public.door_settings (device_id, device_name, connection_mode, is_enabled, region)
SELECT '1002906ff1', 'Puerta Principal', 'webhook', true, 'us'
WHERE NOT EXISTS (SELECT 1 FROM public.door_settings);

-- RLS
ALTER TABLE public.door_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leen door_settings" ON public.door_settings;
CREATE POLICY "Autenticados leen door_settings"
  ON public.door_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin gestiona door_settings" ON public.door_settings;
CREATE POLICY "Admin gestiona door_settings"
  ON public.door_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
