-- =====================================================
-- MIGRACIÓN: PROFESORES POR MÓDULO EN CURSOS
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

create table if not exists public.modulo_profesores (
  id uuid primary key default uuid_generate_v4(),
  module_id uuid not null references public.curso_modulos(id) on delete cascade,
  teacher_id uuid not null references public.profesores(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (module_id, teacher_id)
);

-- Políticas de Seguridad RLS
alter table public.modulo_profesores enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'modulo_profesores' and policyname = 'Permitir lectura publica de modulo_profesores'
  ) then
    create policy "Permitir lectura publica de modulo_profesores" on public.modulo_profesores for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'modulo_profesores' and policyname = 'Permitir gestion total a usuarios autenticados'
  ) then
    create policy "Permitir gestion total a usuarios autenticados" on public.modulo_profesores for all using (true);
  end if;
end $$;
