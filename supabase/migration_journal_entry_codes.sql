-- =====================================================================================
-- MIGRACIÓN: Códigos Identificadores Oficiales NIIF y Correlativos de Asientos Contables
-- Objetivo  : 
--   1. Agregar columnas `entry_number` (número consecutivo) y `entry_code` (código oficial)
--      a la tabla `journal_entries`.
--   2. Asignar códigos oficiales persistentes (AS-YYYY-XXXXX, ING-YYYY-XXXXX, EG-YYYY-XXXXX, NC-YYYY-XXXXX, CR-YYYY-XXXXX).
--   3. Crear trigger automático para que todo nuevo asiento reciba su número y código automáticamente.
--   4. Reclasificar y corregir cuentas de Caja General en `journal_lines` al código oficial 1.1.01.01.
--   5. Poblar retrospectivamente todos los asientos contables históricos con numeración consecutiva.
-- Ejecutar  : Supabase Dashboard → SQL Editor → New query → Ejecutar (Run)
-- =====================================================================================

-- 1. Agregar columnas en journal_entries si no existen
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS entry_number integer,
  ADD COLUMN IF NOT EXISTS entry_code text;

CREATE INDEX IF NOT EXISTS idx_journal_entries_code ON public.journal_entries (entry_code);
CREATE INDEX IF NOT EXISTS idx_journal_entries_num  ON public.journal_entries (entry_number);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date_num ON public.journal_entries (entry_date, entry_number);

-- 2. Función para obtener el siguiente número consecutivo de asiento por año
CREATE OR REPLACE FUNCTION public.fn_next_journal_entry_number(p_year integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
BEGIN
  SELECT COALESCE(MAX(entry_number), 0) + 1
  INTO v_next
  FROM public.journal_entries
  WHERE EXTRACT(YEAR FROM entry_date) = p_year;
  
  RETURN v_next;
END;
$$;

-- 3. Función para generar el código oficial según tipo de asiento
CREATE OR REPLACE FUNCTION public.fn_generate_journal_entry_code(
  p_number integer,
  p_date date,
  p_ref_type text,
  p_description text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text;
  v_seq  text;
  v_desc text;
  v_prefix text := 'AS';
BEGIN
  v_year := to_char(COALESCE(p_date, CURRENT_DATE), 'YYYY');
  v_seq  := lpad(COALESCE(p_number, 1)::text, 5, '0');
  v_desc := lower(COALESCE(p_description, ''));

  IF p_ref_type = 'credit_note' OR v_desc LIKE '%nota de crédito%' OR v_desc LIKE '%credito%' THEN
    v_prefix := 'NC';
  ELSIF p_ref_type = 'invoice' AND (v_desc LIKE '%cobro%' OR v_desc LIKE '%recaudaci%') THEN
    v_prefix := 'ING';
  ELSIF v_desc LIKE '%pago%' OR v_desc LIKE '%cruce%' OR v_desc LIKE '%egreso%' OR v_desc LIKE '%desembolso%' THEN
    v_prefix := 'EG';
  ELSIF v_desc LIKE '%cierre%' THEN
    v_prefix := 'CR';
  ELSE
    v_prefix := 'AS';
  END IF;

  RETURN v_prefix || '-' || v_year || '-' || v_seq;
END;
$$;

-- 4. Trigger BEFORE INSERT para auto-asignar entry_number y entry_code
CREATE OR REPLACE FUNCTION public.trg_journal_entries_assign_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_year integer;
BEGIN
  IF NEW.entry_date IS NULL THEN
    NEW.entry_date := CURRENT_DATE;
  END IF;
  
  v_year := EXTRACT(YEAR FROM NEW.entry_date)::integer;

  IF NEW.entry_number IS NULL THEN
    NEW.entry_number := public.fn_next_journal_entry_number(v_year);
  END IF;

  IF NEW.entry_code IS NULL OR NEW.entry_code = '' THEN
    NEW.entry_code := public.fn_generate_journal_entry_code(
      NEW.entry_number,
      NEW.entry_date,
      NEW.reference_type,
      NEW.description
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_entries_code ON public.journal_entries;
CREATE TRIGGER trg_journal_entries_code
  BEFORE INSERT ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_journal_entries_assign_code();

-- 5. Poblar retrospectivamente los asientos existentes ordenados cronológicamente
DO $$
DECLARE
  r RECORD;
  v_year integer;
  v_curr_year integer := -1;
  v_num integer := 0;
BEGIN
  FOR r IN (
    SELECT id, entry_date, reference_type, description
    FROM public.journal_entries
    ORDER BY entry_date ASC, created_at ASC
  ) LOOP
    v_year := EXTRACT(YEAR FROM r.entry_date)::integer;
    IF v_year <> v_curr_year THEN
      v_curr_year := v_year;
      v_num := 1;
    ELSE
      v_num := v_num + 1;
    END IF;

    UPDATE public.journal_entries
    SET
      entry_number = v_num,
      entry_code = public.fn_generate_journal_entry_code(v_num, r.entry_date, r.reference_type, r.description)
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- 6. Corrección en líneas de diario: asegurar que Caja General use el código oficial 1.1.01.01
UPDATE public.journal_lines
SET account_code = '1.1.01.01', account_name = 'Caja General'
WHERE account_name = 'Caja General' AND account_code = '1.1.01.02';
