-- Migration to update cursos status constraint to include 'in_progress'
alter table public.cursos drop constraint if exists cursos_status_check;
alter table public.cursos drop constraint if exists cursos_status_check1;

alter table public.cursos
  add constraint cursos_status_check
  check (status in ('draft', 'active', 'in_progress', 'completed', 'cancelled'));
