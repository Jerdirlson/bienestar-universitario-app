-- Raíz · administración: is_admin() y contenido de Explorar en la base
--
-- Hasta ahora el contenido de Explorar (canales/perfiles curados) vivía
-- hardcodeado en src/i18n.js — parte del bundle de la app, no editable sin
-- un despliegue. Para que un panel de administración pueda tocarlo de
-- verdad, tiene que vivir en la base. Se migra el mismo contenido que ya
-- estaba (ver conversación del 2026-08-14), no se inventa nada nuevo.
--
-- is_admin() es más estricto que is_moderator(): aprobar/rechazar
-- publicaciones y comentarios, y administrar Explorar, pasan a exigir
-- 'admin' específicamente — 'moderator' ya no alcanza. La razón es de
-- producto, no técnica: eso vive en un panel web aparte, no en la app.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table public.explore_resources (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('live_well', 'relieve_stress', 'relations', 'mindfulness')),
  title       text not null check (char_length(title) between 1 and 100),
  platform    text not null check (platform in ('Instagram', 'YouTube')),
  url         text not null check (char_length(url) between 1 and 500),
  image_url   text,
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index explore_resources_category_idx on public.explore_resources (category, position);

create trigger explore_resources_touch before update on public.explore_resources
  for each row execute function public.touch_updated_at();

alter table public.explore_resources enable row level security;

-- Lectura abierta a cualquier sesión — es lo que ve la pestaña Explorar.
grant select on public.explore_resources to authenticated;
create policy explore_resources_read_all on public.explore_resources
  for select to authenticated using (true);

-- Sin insert/update/delete para authenticated a propósito, mismo patrón que
-- posts: administrar Explorar pasa por el API con service_role, después de
-- comprobar is_admin() con la identidad real. Ver api/src/admin.js.
grant select, insert, update, delete on public.explore_resources to service_role;

insert into public.explore_resources (category, title, platform, url, image_url, position) values
  ('live_well', 'Marian Rojas Estapé', 'Instagram', 'https://www.instagram.com/marianrojasestape/', 'https://images.pexels.com/photos/7176288/pexels-photo-7176288.jpeg?auto=compress&cs=tinysrgb&w=400', 0),
  ('live_well', 'Psicología y Mente', 'Instagram', 'https://www.instagram.com/psicologiaymente/', 'https://images.pexels.com/photos/3958441/pexels-photo-3958441.jpeg?auto=compress&cs=tinysrgb&w=400', 1),
  ('live_well', 'Notas de tu Psicólogo', 'Instagram', 'https://www.instagram.com/notasdetupsicologo/', 'https://images.pexels.com/photos/6756344/pexels-photo-6756344.jpeg?auto=compress&cs=tinysrgb&w=400', 2),

  ('relieve_stress', 'Desansiedad · Fabiola Cuevas', 'Instagram', 'https://www.instagram.com/desansiedad/', 'https://images.pexels.com/photos/4226221/pexels-photo-4226221.jpeg?auto=compress&cs=tinysrgb&w=400', 0),
  ('relieve_stress', 'Mindful Science', 'YouTube', 'https://www.youtube.com/c/MindfulScience', 'https://images.pexels.com/photos/7578245/pexels-photo-7578245.jpeg?auto=compress&cs=tinysrgb&w=400', 1),
  ('relieve_stress', 'Mente Aprende', 'YouTube', 'https://www.youtube.com/channel/UCLJuKe8Rs-WgAsaK1BBbYMA', 'https://images.pexels.com/photos/2983464/pexels-photo-2983464.jpeg?auto=compress&cs=tinysrgb&w=400', 2),

  ('relations', 'Arun Mansukhani', 'YouTube', 'https://www.youtube.com/@ArunMansukhaniPsicologos', 'https://images.pexels.com/photos/3958822/pexels-photo-3958822.jpeg?auto=compress&cs=tinysrgb&w=400', 0),
  ('relations', 'Escuela para Parejas', 'YouTube', 'https://www.youtube.com/c/escuelaparaparejasoficial', 'https://images.pexels.com/photos/4246243/pexels-photo-4246243.jpeg?auto=compress&cs=tinysrgb&w=400', 1),
  ('relations', 'Arun Mansukhani', 'Instagram', 'https://www.instagram.com/arun_mansukhani_psicologos/', 'https://images.pexels.com/photos/23496489/pexels-photo-23496489.jpeg?auto=compress&cs=tinysrgb&w=400', 2),

  ('mindfulness', 'Meditación3 · Miryam', 'YouTube', 'https://www.youtube.com/channel/UCmuESTgut4_eKeWtCpV4Ppw', 'https://images.pexels.com/photos/13849274/pexels-photo-13849274.jpeg?auto=compress&cs=tinysrgb&w=400', 0),
  ('mindfulness', 'Meditación del Día', 'Instagram', 'https://www.instagram.com/meditaciondeldia_/', 'https://images.pexels.com/photos/6453915/pexels-photo-6453915.jpeg?auto=compress&cs=tinysrgb&w=400', 1),
  ('mindfulness', 'Mar del Cerro', 'Instagram', 'https://www.instagram.com/mardelcerro/', 'https://images.pexels.com/photos/13849294/pexels-photo-13849294.jpeg?auto=compress&cs=tinysrgb&w=400', 2);
