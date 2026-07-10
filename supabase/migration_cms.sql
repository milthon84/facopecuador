-- =====================================================
-- MODULO DE CMS Y PORTAL WEB - ESQUEMA SUPABASE
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- 1. Tabla de Artículos / Noticias (web_posts)
create table if not exists public.web_posts (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  slug text unique not null,
  content text not null,
  image_url text,
  status text not null check (status in ('draft', 'published')) default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Tabla de Configuración General de la Web (web_settings)
create table if not exists public.web_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Triggers de actualización automática de updated_at para web_posts
drop trigger if exists trg_web_posts_updated_at on public.web_posts;
create trigger trg_web_posts_updated_at
  before update on public.web_posts
  for each row execute function public.set_updated_at();

-- 3. Habilitar RLS en las tablas
alter table public.web_posts enable row level security;
alter table public.web_settings enable row level security;

-- 4. Políticas de Seguridad (RLS) para web_posts
create policy admin_all_web_posts on public.web_posts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy public_read_web_posts on public.web_posts for select to public using (status = 'published');

-- 5. Políticas de Seguridad (RLS) para web_settings
create policy admin_all_web_settings on public.web_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy public_read_web_settings on public.web_settings for select to public using (true);

-- 6. Valores por defecto (Seed) para web_settings
insert into public.web_settings (key, value)
values 
  ('hero', '{
    "title": "Clínica & Academia Odontológica FACOP",
    "subtitle": "Referentes en odontología clínica avanzada y formación académica de especialistas de alto nivel en Ecuador.",
    "cta_text": "Reservar Cita Médica",
    "cta_whatsapp_text": "Inscribirse en Cursos"
  }'::jsonb),
  ('about', '{
    "mission": "Brindar atención dental con estándares de vanguardia, impulsar el crecimiento de la comunidad odontológica a través de capacitación continua de posgrado y facilitar espacios equipados para la práctica profesional independiente.",
    "vision": "Consolidarnos como la institución líder del Ecuador en servicios odontológicos especializados y educación odontológica continua de nivel internacional."
  }'::jsonb),
  ('contact', '{
    "phone": "0998214857",
    "whatsapp_link": "https://wa.me/593998214857?text=Hola,%20quiero%20más%20información%20sobre%20los%20servicios%20de%20FACOP",
    "facebook_url": "https://www.facebook.com/profile.php?id=61589831153563",
    "instagram_url": "https://www.instagram.com/clinicaodontologicafacop_uio/",
    "tiktok_url": "https://www.tiktok.com/@facopquito",
    "address": "Quito, Ecuador - Sector Iñaquito, Av. de los Shyris"
  }'::jsonb)
on conflict (key) do nothing;

-- 7. Crear artículos semilla de ejemplo
insert into public.web_posts (title, slug, content, image_url, status, published_at)
values
  (
    'Gran Lanzamiento del Congreso Odontológico Internacional FACOP Quito',
    'congreso-internacional-quito-2026',
    'Nos complace anunciar la apertura de las inscripciones para el próximo Congreso Odontológico Internacional organizado por FACOP en la ciudad de Quito. Este evento reunirá a conferencistas internacionales y especialistas de primer nivel de Brasil y Ecuador para debatir las últimas tendencias y avances tecnológicos en Implantología y Estética Dental. Contaremos con talleres prácticos, mesas redondas y demostraciones en vivo. ¡Separa tu cupo a través de nuestros canales de atención!',
    'https://facop.com.ec/wp-content/uploads/2026/05/curos-y-diplomados-1024x559.png',
    'published',
    now()
  ),
  (
    'Beneficios del Coworking Dental para Especialistas Independientes',
    'beneficios-coworking-dental',
    'El coworking dental se ha consolidado como la opción preferida para odontólogos que desean emprender y brindar consultas especializadas sin tener que realizar altas inversiones en equipamiento inicial. En FACOP Ecuador ofrecemos consultorios totalmente equipados y listos para usar en un ambiente profesional, con soporte de secretaría y acceso a tecnología de punta. Ven a conocer nuestras instalaciones y forma parte de la red de especialistas independientes más importante del país.',
    'https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=600&auto=format&fit=crop',
    'published',
    now()
  )
on conflict (slug) do nothing;

-- 8. Creación del bucket para los recursos del sitio web (web-assets)
insert into storage.buckets (id, name, public)
values ('web-assets', 'web-assets', true)
on conflict (id) do nothing;

-- Crear políticas para el bucket de almacenamiento de recursos web
drop policy if exists "Acceso público de lectura a recursos web" on storage.objects;
create policy "Acceso público de lectura a recursos web"
on storage.objects for select to public
using (bucket_id = 'web-assets');

drop policy if exists "Subida de recursos web permitida a administradores" on storage.objects;
create policy "Subida de recursos web permitida a administradores"
on storage.objects for insert to authenticated
with check (bucket_id = 'web-assets');

drop policy if exists "Edición de recursos web permitida a administradores" on storage.objects;
create policy "Edición de recursos web permitida a administradores"
on storage.objects for update to authenticated
using (bucket_id = 'web-assets');

drop policy if exists "Eliminación de recursos web permitida a administradores" on storage.objects;
create policy "Eliminación de recursos web permitida a administradores"
on storage.objects for delete to authenticated
using (bucket_id = 'web-assets');
