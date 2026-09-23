-- Raíz · comunidad v2: temas, edición, motivo de retención, tipos de
-- reacción y respuestas a comentarios.
--
-- El principio de siempre no cambia: nada se publica solo. Una publicación o
-- un comentario sigue naciendo 'pending' (la política de insert lo exige) y
-- después el API, como service_role, lo pasa por el filtro automático
-- (api/src/moderation.js): lo que no tiene riesgo se publica en el acto, lo
-- riesgoso se queda en 'pending' con un motivo (held_reason) para revisión
-- humana. Quien escribe sigue sin poder cambiar el estado de lo suyo.

-- ─────────────────────────────────────────────────────────────────────────────
-- posts
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.posts
  add column if not exists topic text not null default 'general'
    check (topic in ('general', 'estudios', 'ansiedad', 'relaciones', 'logros', 'autocuidado', 'desahogo')),
  add column if not exists edited_at timestamptz,
  -- Por qué está retenida, si lo está. 'crisis' y 'review' los pone el
  -- filtro; 'reports' lo pone el umbral de reportes (…_report_threshold).
  add column if not exists held_reason text
    check (held_reason in ('crisis', 'review', 'reports'));

create index if not exists posts_topic_published_idx
  on public.posts (topic, created_at desc)
  where status = 'published';

create index if not exists posts_author_created_idx
  on public.posts (author_id, created_at desc);

-- La política de insert se endurece: además de nacer pendiente y sin
-- clasificar, quien escribe no puede traer puesto un motivo de retención, una
-- nota de clasificación falsa para despistar a quien modera, ni una marca de
-- edición.
drop policy if exists posts_insert_own_pending on public.posts;
create policy posts_insert_own_pending on public.posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and status = 'pending'
    and risk = 'unscreened'
    and screened_at is null
    and screening_note is null
    and held_reason is null
    and edited_at is null
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- post_comments: respuestas de un nivel y datos del filtro
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.post_comments
  add column if not exists parent_id uuid references public.post_comments (id) on delete cascade,
  add column if not exists screening_note text,
  add column if not exists held_reason text
    check (held_reason in ('crisis', 'review', 'reports'));

create index if not exists post_comments_parent_idx on public.post_comments (parent_id);
create index if not exists post_comments_author_created_idx
  on public.post_comments (author_id, created_at desc);

drop policy if exists comments_insert_own on public.post_comments;
create policy comments_insert_own on public.post_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and status = 'pending' and risk = 'unscreened' and screened_at is null
    and screening_note is null and held_reason is null
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published')
  );

-- Una respuesta apunta a un comentario de PRIMER nivel, publicado, del mismo
-- post. Es un trigger y no parte de la política porque una política de
-- post_comments que consulte post_comments entra en recursión infinita.
-- security definer para ver el comentario padre sin depender de lo que RLS le
-- deje ver a quien responde (igual se exige que esté publicado).
create or replace function public.check_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.post_comments c
    where c.id = new.parent_id
      and c.post_id = new.post_id
      and c.parent_id is null
      and c.status = 'published'
  ) then
    raise exception 'respuesta_invalida' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.check_comment_parent() from public;

drop trigger if exists post_comments_parent_check on public.post_comments;
create trigger post_comments_parent_check
  before insert or update of parent_id on public.post_comments
  for each row execute function public.check_comment_parent();

-- ─────────────────────────────────────────────────────────────────────────────
-- post_reactions: tipo de reacción
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.post_reactions
  add column if not exists kind text not null default 'abrazo'
    check (kind in ('abrazo', 'fuerza', 'te_entiendo', 'inspira'));

-- Una reacción por persona (la llave primaria ya lo impone); volver a
-- reaccionar cambia el tipo. Solo la columna `kind` es editable, y solo
-- mientras la publicación siga publicada.
grant update (kind) on public.post_reactions to authenticated;

drop policy if exists reactions_update_own on public.post_reactions;
create policy reactions_update_own on public.post_reactions
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- service_role: lo que necesita el API para aplicar el filtro y moderar
-- ─────────────────────────────────────────────────────────────────────────────
-- Mismo patrón que moderation_grants.sql: bypassrls salta las políticas pero
-- no los permisos de tabla. Solo columnas que el filtro o la moderación
-- cambian; nada de author_id ni de is_anonymous.

grant select on public.posts, public.post_comments to service_role;

grant update (status, risk, screened_at, screening_note, held_reason, body, mood, topic, edited_at)
  on public.posts to service_role;

grant update (status, risk, screened_at, screening_note, held_reason)
  on public.post_comments to service_role;

grant select on public.post_reports to service_role;
grant update (resolved_at, resolved_by) on public.post_reports to service_role;
