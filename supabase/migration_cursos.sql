-- =====================================================
-- MODULO DE CURSOS - ESQUEMA SUPABASE
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- 1. Tabla de Profesores
create table if not exists public.profesores (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  specialty text,
  phone text,
  email text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Tabla de Cursos
create table if not exists public.cursos (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  total_cost numeric(10, 2) not null check (total_cost >= 0),
  start_date date not null,
  end_date date not null,
  max_students int,
  status text not null check (status in ('draft', 'active', 'completed', 'cancelled')) default 'draft',
  image_url text,                                                                      -- Boceto / Imagen del curso
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cursos_dates_check check (end_date >= start_date)
);

-- 3. Tabla de Módulos del Curso
create table if not exists public.curso_modulos (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references public.cursos(id) on delete cascade,
  number int not null,
  name text not null,
  description text,
  cost numeric(10, 2) not null check (cost >= 0),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_course_module_number unique (course_id, number)
);

-- 4. Asignación de Profesores a Cursos (Map de docentes)
create table if not exists public.curso_profesores (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references public.cursos(id) on delete cascade,
  teacher_id uuid not null references public.profesores(id) on delete cascade,
  role text check (role in ('principal', 'auxiliar', 'invitado')) default 'principal',
  created_at timestamptz not null default now(),
  unique (course_id, teacher_id)
);

-- 5. Tabla de Alumnos
create table if not exists public.alumnos (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  document_number text unique not null,                  -- Cédula o pasaporte
  phone text not null,
  email text unique not null,
  professional_title text,                              -- Ej: Odontólogo General, Especialista
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Inscripciones Generales a un Curso
create table if not exists public.curso_inscripciones (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references public.cursos(id) on delete restrict,
  student_id uuid not null references public.alumnos(id) on delete restrict,
  status text not null check (status in ('enrolled', 'completed', 'dropped')) default 'enrolled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, student_id)
);

-- 7. Facturación e Inscripción Detallada por Módulo
create table if not exists public.curso_modulo_inscripciones (
  id uuid primary key default uuid_generate_v4(),
  enrollment_id uuid not null references public.curso_inscripciones(id) on delete cascade,
  module_id uuid not null references public.curso_modulos(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null, -- Enlace con la factura SRI si ya se cobró
  billing_status text not null check (billing_status in ('pending', 'invoiced', 'free')) default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, module_id)
);

-- 8. Clases / Sesiones
create table if not exists public.curso_clases (
  id uuid primary key default uuid_generate_v4(),
  module_id uuid not null references public.curso_modulos(id) on delete cascade,
  title text not null,
  description text,
  date date not null,
  start_time time not null,
  end_time time not null,
  teacher_id uuid references public.profesores(id) on delete set null,
  classroom text,                                       -- Aula o laboratorio
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. Control de Asistencia a Clases
create table if not exists public.curso_asistencia (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.curso_clases(id) on delete cascade,
  student_id uuid not null references public.alumnos(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'justified')) default 'present',
  notes text,
  created_at timestamptz not null default now(),
  unique (class_id, student_id)
);

-- 10. Historial de Avisos y Notificaciones a Alumnos
create table if not exists public.curso_avisos (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references public.cursos(id) on delete cascade,
  class_id uuid references public.curso_clases(id) on delete cascade, -- Opcional: asociado a una clase específica
  subject text not null,
  message text not null,
  sent_by uuid references auth.users(id),
  sent_at timestamptz not null default now(),
  status text not null check (status in ('draft', 'pending', 'sent', 'failed')) default 'pending'
);

-- Triggers de actualización automática de updated_at
drop trigger if exists trg_profesores_updated_at on public.profesores;
create trigger trg_profesores_updated_at
  before update on public.profesores
  for each row execute function public.set_updated_at();

drop trigger if exists trg_cursos_updated_at on public.cursos;
create trigger trg_cursos_updated_at
  before update on public.cursos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_curso_modulos_updated_at on public.curso_modulos;
create trigger trg_curso_modulos_updated_at
  before update on public.curso_modulos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_alumnos_updated_at on public.alumnos;
create trigger trg_alumnos_updated_at
  before update on public.alumnos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_curso_inscripciones_updated_at on public.curso_inscripciones;
create trigger trg_curso_inscripciones_updated_at
  before update on public.curso_inscripciones
  for each row execute function public.set_updated_at();

drop trigger if exists trg_curso_modulo_inscripciones_updated_at on public.curso_modulo_inscripciones;
create trigger trg_curso_modulo_inscripciones_updated_at
  before update on public.curso_modulo_inscripciones
  for each row execute function public.set_updated_at();

drop trigger if exists trg_curso_clases_updated_at on public.curso_clases;
create trigger trg_curso_clases_updated_at
  before update on public.curso_clases
  for each row execute function public.set_updated_at();

-- Habilitar RLS en todas las nuevas tablas
alter table public.profesores enable row level security;
alter table public.cursos enable row level security;
alter table public.curso_modulos enable row level security;
alter table public.curso_profesores enable row level security;
alter table public.alumnos enable row level security;
alter table public.curso_inscripciones enable row level security;
alter table public.curso_modulo_inscripciones enable row level security;
alter table public.curso_clases enable row level security;
alter table public.curso_asistencia enable row level security;
alter table public.curso_avisos enable row level security;

-- Políticas de RLS: Acceso total para administradores
create policy admin_all_profesores on public.profesores for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all_cursos on public.cursos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all_curso_modulos on public.curso_modulos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all_curso_profesores on public.curso_profesores for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all_alumnos on public.alumnos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all_curso_inscripciones on public.curso_inscripciones for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all_curso_modulo_inscripciones on public.curso_modulo_inscripciones for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all_curso_clases on public.curso_clases for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all_curso_asistencia on public.curso_asistencia for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all_curso_avisos on public.curso_avisos for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Políticas de RLS: Permiso para lectura y escritura básica para otros roles autorizados
-- Alumnos, inscripciones, clases, asistencia y avisos también son accesibles por la Recepcionista
create policy recepcionista_all_alumnos on public.alumnos for all to authenticated
  using (true)
  with check (true);

create policy recepcionista_all_curso_inscripciones on public.curso_inscripciones for all to authenticated
  using (true)
  with check (true);

create policy recepcionista_all_curso_modulo_inscripciones on public.curso_modulo_inscripciones for all to authenticated
  using (true)
  with check (true);

create policy recepcionista_all_curso_clases on public.curso_clases for all to authenticated
  using (true)
  with check (true);

create policy recepcionista_all_curso_asistencia on public.curso_asistencia for all to authenticated
  using (true)
  with check (true);

create policy recepcionista_all_curso_avisos on public.curso_avisos for all to authenticated
  using (true)
  with check (true);

-- Profesores y Cursos también son de lectura para Recepcionista y Contador
create policy public_read_profesores on public.profesores for select to authenticated using (true);
create policy public_read_cursos on public.cursos for select to authenticated using (true);
create policy public_read_curso_modulos on public.curso_modulos for select to authenticated using (true);
create policy public_read_curso_profesores on public.curso_profesores for select to authenticated using (true);

-- 11. Creación del bucket para bocetos / imágenes de cursos
insert into storage.buckets (id, name, public)
values ('course-banners', 'course-banners', true)
on conflict (id) do nothing;

-- Crear políticas para el bucket de almacenamiento de imágenes
drop policy if exists "Acceso público de lectura a portadas de cursos" on storage.objects;
create policy "Acceso público de lectura a portadas de cursos"
on storage.objects for select to public
using (bucket_id = 'course-banners');

drop policy if exists "Subida permitida a usuarios autenticados" on storage.objects;
create policy "Subida permitida a usuarios autenticados"
on storage.objects for insert to authenticated
with check (bucket_id = 'course-banners');

drop policy if exists "Edición permitida a usuarios autenticados" on storage.objects;
create policy "Edición permitida a usuarios autenticados"
on storage.objects for update to authenticated
using (bucket_id = 'course-banners');

drop policy if exists "Eliminación permitida a usuarios autenticados" on storage.objects;
create policy "Eliminación permitida a usuarios autenticados"
on storage.objects for delete to authenticated
using (bucket_id = 'course-banners');
