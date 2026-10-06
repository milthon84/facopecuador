-- ==============================================================================
-- Migración: Roles de Especialistas (Atención a Pacientes & Profesor / Cursos)
-- ==============================================================================

-- 1. Agregar columnas booleanas con valor por defecto true para no romper registros existentes
ALTER TABLE public.profesores 
ADD COLUMN IF NOT EXISTS is_doctor BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_teacher BOOLEAN DEFAULT TRUE;

-- 2. Asegurar que los registros existentes tengan true
UPDATE public.profesores SET is_doctor = TRUE WHERE is_doctor IS NULL;
UPDATE public.profesores SET is_teacher = TRUE WHERE is_teacher IS NULL;

-- 3. Índices para optimizar consultas por rol
CREATE INDEX IF NOT EXISTS idx_profesores_is_doctor ON public.profesores(is_doctor) WHERE is_doctor = TRUE;
CREATE INDEX IF NOT EXISTS idx_profesores_is_teacher ON public.profesores(is_teacher) WHERE is_teacher = TRUE;
