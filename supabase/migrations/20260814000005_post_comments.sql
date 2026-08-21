-- Raíz · comentarios en publicaciones
--
-- Mismo principio que posts (ver initial_schema.sql): nada se publica solo.
-- Un comentario nace 'pending' y necesita moderación antes de que nadie más
-- lo vea — la misma razón que aplica a un post aplica a un comentario, no hay
-- motivo para que uno tenga la puerta de seguridad y el otro no.
--
-- Reutiliza post_status y risk_level (ya existen para posts) en vez de crear
-- tipos nuevos — es el mismo concepto, no uno distinto por estar en otra tabla.

create table public.post_comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts (id) on delete cascade,
  author_id     uuid not null references public.profiles (id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 1000),

  -- Mismo mecanismo de anonimato que posts.author_display_name — ver esa
  -- migración para por qué es una copia y no un join.
  is_anonymous  boolean not null default true,
  author_display_name text,

  status        public.post_status not null default 'pending',
  risk          public.risk_level not null default 'unscreened',
  screened_at   timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint post_comments_author_name_consistency check (is_anonymous or author_display_name is not null)
);

create index post_comments_published_idx
  on public.post_comments (post_id, created_at)
  where status = 'published';

create index post_comments_queue_idx
  on public.post_comments (created_at)
  where status = 'pending';

create trigger post_comments_touch before update on public.post_comments
  for each row execute function public.touch_updated_at();

alter table public.post_comments enable row level security;

grant select, insert, delete on public.post_comments to authenticated;
-- Igual que posts: sin update para authenticated. Moderar (publicar/rechazar
-- un comentario) es cosa de service_role, ver moderation_grants.sql.

-- Se puede ver un comentario publicado si se puede ver el post donde vive
-- (publicado, o propio). Comentar en un post ajeno pendiente no debería ni
-- llegar a pasar (comments_insert_own lo exige publicado), pero esto cubre
-- además el caso de un post propio que un moderador esté revisando.
create policy comments_select_published on public.post_comments
  for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.posts p
      where p.id = post_id and (p.status = 'published' or p.author_id = auth.uid())
    )
  );

create policy comments_select_own on public.post_comments
  for select to authenticated
  using (author_id = auth.uid());

create policy comments_select_moderator on public.post_comments
  for select to authenticated
  using (public.is_moderator());

-- Solo se comenta sobre lo que ya está publicado — mismo criterio que
-- reactions_insert_own en posts.
create policy comments_insert_own on public.post_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and status = 'pending' and risk = 'unscreened' and screened_at is null
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published')
  );

create policy comments_delete_own on public.post_comments
  for delete to authenticated
  using (author_id = auth.uid());

create policy comments_delete_moderator on public.post_comments
  for delete to authenticated
  using (public.is_moderator());

-- Grants de service_role para moderar, mismo patrón que moderation_grants.sql
-- (ver ese archivo para por qué bypassrls no alcanza sin esto).
grant update (status, risk, screened_at) on public.post_comments to service_role;
grant select (id, status, post_id) on public.post_comments to service_role;
