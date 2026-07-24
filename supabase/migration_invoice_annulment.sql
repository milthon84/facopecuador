-- =====================================================
-- MIGRACIÓN: Permitir estado 'cancelled' en invoices.payment_status
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Buscar y eliminar cualquier check constraint existente que contenga 'payment_status'
    FOR r IN
        SELECT conname
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = conrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE relname = 'invoices'
          AND contype = 'c'
          AND consrc LIKE '%payment_status%'
    LOOP
        EXECUTE 'ALTER TABLE public.invoices DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END;
$$;

-- Volver a crear el check constraint incluyendo 'cancelled'
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_payment_status_check
  CHECK (payment_status IN ('paid', 'pending', 'partial', 'cancelled'));
