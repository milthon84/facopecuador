-- =====================================================
-- MIGRACIÓN: Inscripciones públicas a cursos vía web
-- Permite al service_role (cliente admin) insertar/actualizar
-- en alumnos y curso_inscripciones sin autenticación de usuario.
-- Las APIs públicas usan createAdminClient() que tiene service_role.
-- =====================================================

-- El cliente admin (service_role) tiene acceso completo y bypasea RLS.
-- No se necesitan políticas adicionales para el flujo de inscripción web.
-- Sin embargo, si se desea permitir lectura pública de cursos activos:

-- Política de lectura pública para cursos activos (sin autenticación)
drop policy if exists "public_read_active_cursos" on public.cursos;
create policy "public_read_active_cursos"
  on public.cursos
  for select
  to anon
  using (status = 'active');

-- Verificar que las tablas existen (sin error si ya existen)
-- Las inserciones se hacen vía service_role en el API handler

-- NOTA: El endpoint /api/cursos/inscribirse usa createAdminClient()
-- que usa SUPABASE_SERVICE_ROLE_KEY y tiene acceso completo.
-- No requiere políticas RLS adicionales para escritura.
