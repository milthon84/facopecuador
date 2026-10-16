-- =====================================================
-- MIGRACIÓN: CONTROL DE ASISTENCIA CON SELFIE Y GPS
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- 1) BUCKET DE ALMACENAMIENTO PARA FOTOS DE ASISTENCIA (SELFIE)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attendance-photos',
  'attendance-photos',
  true,
  5242880, -- 5 MB máximo por foto
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas del bucket de fotos de asistencia
DROP POLICY IF EXISTS "Lectura pública de fotos de asistencia" ON storage.objects;
CREATE POLICY "Lectura pública de fotos de asistencia"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'attendance-photos');

DROP POLICY IF EXISTS "Usuarios autenticados suben fotos de asistencia" ON storage.objects;
CREATE POLICY "Usuarios autenticados suben fotos de asistencia"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attendance-photos');

DROP POLICY IF EXISTS "Admin gestiona fotos de asistencia" ON storage.objects;
CREATE POLICY "Admin gestiona fotos de asistencia"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'attendance-photos' AND public.is_admin())
  WITH CHECK (bucket_id = 'attendance-photos' AND public.is_admin());


-- 2) TABLA: attendance_office_settings (Coordenadas y Geocerca de la Clínica/Oficina)
CREATE TABLE IF NOT EXISTS public.attendance_office_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_name TEXT NOT NULL DEFAULT 'Sede Principal',
  latitude NUMERIC(10, 7) NOT NULL DEFAULT -0.1806532,
  longitude NUMERIC(10, 7) NOT NULL DEFAULT -78.4678382,
  radius_meters INT NOT NULL DEFAULT 150,                 -- Radio de tolerancia en metros
  require_photo BOOLEAN NOT NULL DEFAULT TRUE,
  require_location BOOLEAN NOT NULL DEFAULT TRUE,
  allow_out_of_bounds BOOLEAN NOT NULL DEFAULT TRUE,      -- Permite marcar pero etiqueta como 'Fuera de Oficina'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_attendance_office_settings_updated_at ON public.attendance_office_settings;
CREATE TRIGGER trg_attendance_office_settings_updated_at
  BEFORE UPDATE ON public.attendance_office_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Registro por defecto de configuración de oficina si no existe
INSERT INTO public.attendance_office_settings (office_name, latitude, longitude, radius_meters, require_photo, require_location, allow_out_of_bounds)
SELECT 'Sede Principal FACOP', -0.1806532, -78.4678382, 150, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.attendance_office_settings);


-- 3) TABLA: attendance_shifts (Horarios y Tolerancias de Entrada/Salida)
CREATE TABLE IF NOT EXISTS public.attendance_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'Jornada Regular',
  start_time TIME NOT NULL DEFAULT '08:00:00',
  end_time TIME NOT NULL DEFAULT '17:00:00',
  grace_minutes INT NOT NULL DEFAULT 10,                 -- Minutos de tolerancia antes de marcar atraso
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_attendance_shifts_updated_at ON public.attendance_shifts;
CREATE TRIGGER trg_attendance_shifts_updated_at
  BEFORE UPDATE ON public.attendance_shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Registro por defecto de turno regular si no existe
INSERT INTO public.attendance_shifts (name, start_time, end_time, grace_minutes)
SELECT 'Jornada Diurna Regular', '08:00:00', '17:00:00', 10
WHERE NOT EXISTS (SELECT 1 FROM public.attendance_shifts);


-- 4) TABLA: attendance_punches (Registro de Marcaciones de Asistencia)
CREATE TABLE IF NOT EXISTS public.attendance_punches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  punched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  punch_type TEXT NOT NULL CHECK (punch_type IN ('in', 'out')), -- 'in' (Entrada) o 'out' (Salida)
  
  -- Evidencia de Foto Selfie
  photo_url TEXT NOT NULL,
  photo_path TEXT NOT NULL,
  
  -- Evidencia de Ubicación GPS
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  accuracy NUMERIC(8, 2),                                 -- Precisión en metros reportada por el GPS
  distance_meters NUMERIC(8, 2),                          -- Distancia calculada a la sede en metros
  is_in_office BOOLEAN NOT NULL DEFAULT TRUE,             -- True si distance_meters <= radius_meters
  
  -- Análisis de Puntualidad
  is_late BOOLEAN NOT NULL DEFAULT FALSE,
  late_minutes INT NOT NULL DEFAULT 0,
  
  -- Metadatos y Auditoría
  device_info TEXT,
  ip_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para optimizar consultas por usuario, fecha y filtros de control
CREATE INDEX IF NOT EXISTS idx_punches_user_id ON public.attendance_punches(user_id);
CREATE INDEX IF NOT EXISTS idx_punches_punched_at ON public.attendance_punches(punched_at DESC);
CREATE INDEX IF NOT EXISTS idx_punches_user_date ON public.attendance_punches(user_id, punched_at);


-- 5) SEGURIDAD Y POLÍTICAS RLS
ALTER TABLE public.attendance_office_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_punches ENABLE ROW LEVEL SECURITY;

-- attendance_office_settings
DROP POLICY IF EXISTS "Autenticados leen settings de asistencia" ON public.attendance_office_settings;
CREATE POLICY "Autenticados leen settings de asistencia"
  ON public.attendance_office_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin gestiona settings de asistencia" ON public.attendance_office_settings;
CREATE POLICY "Admin gestiona settings de asistencia"
  ON public.attendance_office_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- attendance_shifts
DROP POLICY IF EXISTS "Autenticados leen turnos de asistencia" ON public.attendance_shifts;
CREATE POLICY "Autenticados leen turnos de asistencia"
  ON public.attendance_shifts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin gestiona turnos de asistencia" ON public.attendance_shifts;
CREATE POLICY "Admin gestiona turnos de asistencia"
  ON public.attendance_shifts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- attendance_punches
DROP POLICY IF EXISTS "Usuarios leen sus propias marcaciones o admin lee todas" ON public.attendance_punches;
CREATE POLICY "Usuarios leen sus propias marcaciones o admin lee todas"
  ON public.attendance_punches FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Usuarios insertan su propia marcacion" ON public.attendance_punches;
CREATE POLICY "Usuarios insertan su propia marcacion"
  ON public.attendance_punches FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin gestiona marcaciones" ON public.attendance_punches;
CREATE POLICY "Admin gestiona marcaciones"
  ON public.attendance_punches FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- 6) REGISTRAR PERMISOS EN EL SISTEMA DE ROLES
INSERT INTO public.role_permissions (role_name, path) VALUES
  ('admin', '/erp/asistencia'),
  ('admin', '/erp/asistencia/modificar'),
  ('recepcionista', '/erp/asistencia')
ON CONFLICT DO NOTHING;
