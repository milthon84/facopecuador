-- =====================================================================================
-- FIX: Agregar cuenta de movimiento 5.2.05.03 — Suministros de Oficina
-- Contexto: El plan original tenía código 5.2.05.02 duplicado.
--           "Útiles de Aseo" quedó como 5.2.05.02.
--           "Suministros de Oficina" necesitaba 5.2.05.03 y no fue creada.
-- Ejecutar : Supabase Dashboard → SQL Editor
-- Fecha    : 2026-11-08
-- =====================================================================================

insert into public.accounts (code, name, type, subtype, is_movement)
values ('5.2.05.03', 'Suministros de Oficina', 'GASTO', 'administrativo', true)
on conflict (code) do update set
  name        = excluded.name,
  type        = excluded.type,
  subtype     = excluded.subtype,
  is_movement = excluded.is_movement;

-- Verificación (debe devolver la cuenta recién creada):
select code, name, type, subtype, is_movement, active
from public.accounts
where code like '5.2.05%'
order by code;
