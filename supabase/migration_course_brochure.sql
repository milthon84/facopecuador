-- Agregar columna brochure_url para folletos/temarios digitales de los cursos
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS brochure_url text;
