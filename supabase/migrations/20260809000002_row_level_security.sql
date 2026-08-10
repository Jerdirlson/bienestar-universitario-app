-- Raíz · Row Level Security
--
-- Esta migración es la que de verdad protege los datos. Postgres evalúa estas
-- políticas en cada consulta, así que un error en el cliente no puede filtrar
-- información: la base se niega.
--
-- La regla que no se negocia: NADIE, ni moderadores ni administradores, puede
-- leer `entries` de otra persona a través del cliente. El diario es privado.
-- Si algún día hace falta acceso clínico, tiene que ser un flujo aparte,
-- consentido explícitamente y registrado en access_audit.
--
-- Nota sobre ENABLE vs FORCE: `force row level security` sujeta también al dueño
-- de la tabla a las políticas. Aquí no se usa porque haría que
-- public.is_moderator() — que lee profiles — se llame a sí misma en bucle al
-- evaluar las políticas de profiles. Los roles del cliente (anon, authenticated)
-- no son dueños, así que `enable` ya los cubre; service_role pasa por encima por
-- diseño y es la que usa el backend de moderación.

-- ─────────────────────────────────────────────────────────────────────────────
-- Ayudante de rol
-- ─────────────────────────────────────────────────────────────────────────────

-- security definer para que no vuelva a pasar por las políticas de profiles.
-- search_path vacío y todo calificado con el esquema: sin eso, un search_path
-- manipulado podría hacer que lea otra tabla.
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('moderator', 'admin')
  );
$$;

revoke execute on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos base: negar todo, luego conceder lo justo
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on all tables in schema public from anon, authenticated;

alter table public.profiles            enable row level security;
alter table public.entries             enable row level security;
alter table public.challenges          enable row level security;
alter table public.user_challenges     enable row level security;
alter table public.posts               enable row level security;
alter table public.post_reactions      enable row level security;
alter table public.post_reports        enable row level security;
alter table public.moderation_actions  enable row level security;
alter table public.access_audit        enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────

-- Solo estas dos columnas son editables desde el cliente. Es lo que impide que
-- alguien se ascienda a moderador con un update a su propia fila: el permiso de
-- escritura sobre `role` sencillamente no existe para authenticated.
grant select on public.profiles to authenticated;
grant update (display_name, locale) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- entries · privado sin excepciones
-- ─────────────────────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.entries to authenticated;

create policy entries_own_select on public.entries
  for select to authenticated
  using (user_id = auth.uid());

create policy entries_own_insert on public.entries
  for insert to authenticated
  with check (user_id = auth.uid());

create policy entries_own_update on public.entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy entries_own_delete on public.entries
  for delete to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- challenges · catálogo de solo lectura
-- ─────────────────────────────────────────────────────────────────────────────

grant select on public.challenges to authenticated;

create policy challenges_read_active on public.challenges
  for select to authenticated
  using (is_active);

grant select, insert, update, delete on public.user_challenges to authenticated;

create policy user_challenges_own on public.user_challenges
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- posts
-- ─────────────────────────────────────────────────────────────────────────────

grant select, insert, delete on public.posts to authenticated;
-- Sin update para authenticated: quien escribe no puede editar después de
-- pasar el filtro, ni cambiarse el estado. Moderar es cosa de service_role.

create policy posts_select_published on public.posts
  for select to authenticated
  using (status = 'published');

-- Quien escribe siempre ve lo suyo, incluso mientras está en cola o rechazado,
-- para que no parezca que la publicación se perdió.
create policy posts_select_own on public.posts
  for select to authenticated
  using (author_id = auth.uid());

create policy posts_select_moderator on public.posts
  for select to authenticated
  using (public.is_moderator());

-- El with check es lo que impide autopublicarse: aunque el cliente mande
-- status='published', la base rechaza la fila.
create policy posts_insert_own_pending on public.posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and status = 'pending'
    and risk = 'unscreened'
    and screened_at is null
  );

create policy posts_delete_own on public.posts
  for delete to authenticated
  using (author_id = auth.uid());

create policy posts_delete_moderator on public.posts
  for delete to authenticated
  using (public.is_moderator());

-- ─────────────────────────────────────────────────────────────────────────────
-- post_reactions
-- ─────────────────────────────────────────────────────────────────────────────

grant select, insert, delete on public.post_reactions to authenticated;

create policy reactions_select_visible on public.post_reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and (p.status = 'published' or p.author_id = auth.uid())
    )
  );

-- Solo se puede reaccionar a lo que ya está publicado.
create policy reactions_insert_own on public.post_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published'
    )
  );

create policy reactions_delete_own on public.post_reactions
  for delete to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- post_reports
-- ─────────────────────────────────────────────────────────────────────────────

grant select, insert on public.post_reports to authenticated;
-- Sin update ni delete: un reporte no se retira. Lo resuelve la moderación.

create policy reports_insert_own on public.post_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

create policy reports_select_own on public.post_reports
  for select to authenticated
  using (reporter_id = auth.uid());

create policy reports_select_moderator on public.post_reports
  for select to authenticated
  using (public.is_moderator());

-- ─────────────────────────────────────────────────────────────────────────────
-- moderation_actions · bitácora de solo lectura
-- ─────────────────────────────────────────────────────────────────────────────

grant select on public.moderation_actions to authenticated;
-- Escribe únicamente service_role: la bitácora no se puede alterar desde el
-- cliente ni siquiera siendo moderador.

create policy moderation_select_moderator on public.moderation_actions
  for select to authenticated
  using (public.is_moderator());

-- ─────────────────────────────────────────────────────────────────────────────
-- access_audit · sin acceso desde el cliente
-- ─────────────────────────────────────────────────────────────────────────────

-- RLS activo y cero políticas = negado para todos. Solo service_role entra.
-- No agregar políticas aquí sin revisarlo: es el registro que respalda una
-- auditoría ante la SIC.
