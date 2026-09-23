-- Raíz · "me gusta" y reportes de comentarios
--
-- Mismo diseño que post_reactions y post_reports, aplicado a comentarios.

-- ─────────────────────────────────────────────────────────────────────────────
-- comment_likes
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.comment_likes (
  comment_id uuid not null references public.post_comments (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_likes_user_idx on public.comment_likes (user_id);

alter table public.comment_likes enable row level security;
revoke all on public.comment_likes from anon, authenticated;
grant select, insert, delete on public.comment_likes to authenticated;

-- Se ven los "me gusta" de los comentarios que se pueden ver: la subconsulta
-- pasa por las políticas de post_comments de quien pregunta.
drop policy if exists comment_likes_select_visible on public.comment_likes;
create policy comment_likes_select_visible on public.comment_likes
  for select to authenticated
  using (exists (select 1 from public.post_comments c where c.id = comment_id));

-- Solo sobre comentarios ya publicados, igual que las reacciones a posts.
drop policy if exists comment_likes_insert_own on public.comment_likes;
create policy comment_likes_insert_own on public.comment_likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.post_comments c where c.id = comment_id and c.status = 'published')
  );

drop policy if exists comment_likes_delete_own on public.comment_likes;
create policy comment_likes_delete_own on public.comment_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- comment_reports
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.comment_reports (
  id           uuid primary key default gen_random_uuid(),
  comment_id   uuid not null references public.post_comments (id) on delete cascade,
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  reason       public.report_reason not null,
  detail       text check (char_length(detail) <= 1000),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles (id) on delete set null,

  -- Una persona reporta un comentario una sola vez.
  unique (comment_id, reporter_id)
);

create index if not exists comment_reports_open_idx
  on public.comment_reports (created_at)
  where resolved_at is null;

alter table public.comment_reports enable row level security;
revoke all on public.comment_reports from anon, authenticated;
grant select, insert on public.comment_reports to authenticated;
-- Sin update ni delete: un reporte no se retira. Lo resuelve la moderación.

drop policy if exists comment_reports_insert_own on public.comment_reports;
create policy comment_reports_insert_own on public.comment_reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and resolved_at is null and resolved_by is null);

drop policy if exists comment_reports_select_own on public.comment_reports;
create policy comment_reports_select_own on public.comment_reports
  for select to authenticated
  using (reporter_id = auth.uid());

drop policy if exists comment_reports_select_moderator on public.comment_reports;
create policy comment_reports_select_moderator on public.comment_reports
  for select to authenticated
  using (public.is_moderator());

grant select on public.comment_reports to service_role;
grant update (resolved_at, resolved_by) on public.comment_reports to service_role;

-- post_reports tenía la misma rendija: se podía insertar un reporte ya
-- "resuelto". Se cierra igual.
drop policy if exists reports_insert_own on public.post_reports;
create policy reports_insert_own on public.post_reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and resolved_at is null and resolved_by is null);
