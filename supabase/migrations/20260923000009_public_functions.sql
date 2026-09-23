-- Raíz · funciones públicas de la comunidad v2
--
-- `profiles` sigue dejando leer solo la fila propia. Todo lo que el API
-- necesita saber de OTRAS personas pasa por estas funciones security definer,
-- que siguen tres reglas:
--
--   1. Nunca reciben ni devuelven el id interno de otra persona. Reciben un
--      public_id, o el id de una publicación/comentario/notificación, y
--      resuelven al autor por dentro. Así ninguna sirve de oráculo para
--      cruzar contra posts.author_id y desanonimizar.
--   2. Solo columnas públicas (public_id, alias, avatar, bio) y solo de quien
--      eligió un nombre.
--   3. Lo anónimo devuelve null. Siempre.
--
-- Las funciones que sí reciben ids internos (hides_content, notify, …) no se
-- conceden a nadie; ver las migraciones anteriores.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tarjeta pública de autor (interna)
-- ─────────────────────────────────────────────────────────────────────────────

-- p_name permite usar el alias copiado en la publicación (author_display_name,
-- ver post_anonymity.sql: lo publicado no cambia de firma si la persona se
-- cambia el nombre después).
create or replace function public.author_card(p_profile uuid, p_name text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'public_id',    pr.public_id,
    'display_name', coalesce(p_name, pr.display_name),
    'avatar_emoji', pr.avatar_emoji,
    'avatar_color', pr.avatar_color
  )
  from public.profiles pr
  where pr.id = p_profile and pr.display_name is not null;
$$;

revoke all on function public.author_card(uuid, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Autor de una publicación / comentario, actor de una notificación
-- ─────────────────────────────────────────────────────────────────────────────

-- null si es anónima, si no existe o si quien pregunta no la puede ver.
create or replace function public.post_author(p_post_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.author_card(p.author_id, p.author_display_name)
  from public.posts p
  where p.id = p_post_id
    and not p.is_anonymous
    and (p.status = 'published' or p.author_id = auth.uid() or public.is_moderator());
$$;

create or replace function public.comment_author(p_comment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.author_card(c.author_id, c.author_display_name)
  from public.post_comments c
  join public.posts p on p.id = c.post_id
  where c.id = p_comment_id
    and not c.is_anonymous
    and (
      (c.status = 'published' and (p.status = 'published' or p.author_id = auth.uid()))
      or c.author_id = auth.uid()
      or public.is_moderator()
    );
$$;

-- Solo notificaciones propias, y solo si quien actuó lo hizo con su nombre.
create or replace function public.notification_actor(p_notification_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.author_card(n.actor_id, null)
  from public.notifications n
  where n.id = p_notification_id
    and n.recipient_id = auth.uid()
    and n.actor_visible;
$$;

revoke all on function public.post_author(uuid) from public, anon;
revoke all on function public.comment_author(uuid) from public, anon;
revoke all on function public.notification_actor(uuid) from public, anon;
grant execute on function public.post_author(uuid) to authenticated;
grant execute on function public.comment_author(uuid) to authenticated;
grant execute on function public.notification_actor(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- ¿Oculto por un bloqueo?
-- ─────────────────────────────────────────────────────────────────────────────
-- Responden por contenido que quien pregunta ya puede ver, con las mismas
-- reglas que aplica el feed. No dicen nada que el feed no diga.

create or replace function public.post_hidden_for_me(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.hides_content(auth.uid(), p.author_id, p.is_anonymous)
    from public.posts p
    where p.id = p_post_id and (p.status = 'published' or p.author_id = auth.uid())
  ), false);
$$;

create or replace function public.comment_hidden_for_me(p_comment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.hides_content(auth.uid(), c.author_id, c.is_anonymous)
    from public.post_comments c
    where c.id = p_comment_id and (c.status = 'published' or c.author_id = auth.uid())
  ), false);
$$;

revoke all on function public.post_hidden_for_me(uuid) from public, anon;
revoke all on function public.comment_hidden_for_me(uuid) from public, anon;
grant execute on function public.post_hidden_for_me(uuid) to authenticated;
grant execute on function public.comment_hidden_for_me(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Perfiles públicos
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.public_profile(p_public_id text)
returns table (
  public_id      text,
  display_name   text,
  avatar_emoji   text,
  avatar_color   text,
  bio            text,
  member_since   timestamptz,
  post_count     int,
  followers      int,
  following      int,
  followed_by_me boolean,
  is_me          boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pr.public_id, pr.display_name, pr.avatar_emoji, pr.avatar_color, pr.bio, pr.created_at,
    -- Solo lo publicado CON NOMBRE: contar lo anónimo diría cuánto anónimo
    -- escribió esta persona.
    (select count(*)::int from public.posts p
      where p.author_id = pr.id and p.status = 'published' and not p.is_anonymous),
    (select count(*)::int from public.follows f where f.followee_id = pr.id),
    (select count(*)::int from public.follows f where f.follower_id = pr.id),
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = pr.id),
    pr.id = auth.uid()
  from public.profiles pr
  where pr.public_id = p_public_id
    and pr.display_name is not null
    and auth.uid() is not null
    and (pr.id = auth.uid() or not public.named_block_between(auth.uid(), pr.id));
$$;

-- Ids de las publicaciones CON NOMBRE de una persona, para
-- GET /users/:publicId/posts. El API arma el objeto Post con esos ids por el
-- camino normal (withUser), así que RLS vuelve a filtrar.
create or replace function public.public_user_post_ids(p_public_id text, p_before timestamptz, p_limit int)
returns table (id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where pr.public_id = p_public_id
    and pr.display_name is not null
    and auth.uid() is not null
    and p.status = 'published'
    and not p.is_anonymous
    and (pr.id = auth.uid() or not public.named_block_between(auth.uid(), pr.id))
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.public_profile(text) from public, anon;
revoke all on function public.public_user_post_ids(text, timestamptz, int) from public, anon;
grant execute on function public.public_profile(text) to authenticated;
grant execute on function public.public_user_post_ids(text, timestamptz, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seguir
-- ─────────────────────────────────────────────────────────────────────────────
-- Errores con mensaje fijo, que el API traduce: 'not_found' y
-- 'accion_invalida'. Un bloqueo con nombre en cualquier sentido responde
-- igual que un perfil inexistente.

create or replace function public.follow_user(p_public_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
begin
  if me is null then
    raise exception 'sin_sesion' using errcode = 'insufficient_privilege';
  end if;
  select pr.id into target from public.profiles pr
   where pr.public_id = p_public_id and pr.display_name is not null;
  if target is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if target = me then
    raise exception 'accion_invalida' using errcode = 'invalid_parameter_value';
  end if;
  if public.named_block_between(me, target) then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  insert into public.follows (follower_id, followee_id) values (me, target)
    on conflict do nothing;
end;
$$;

create or replace function public.unfollow_user(p_public_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
begin
  if me is null then
    raise exception 'sin_sesion' using errcode = 'insufficient_privilege';
  end if;
  select pr.id into target from public.profiles pr where pr.public_id = p_public_id;
  if target is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if target = me then
    raise exception 'accion_invalida' using errcode = 'invalid_parameter_value';
  end if;
  delete from public.follows where follower_id = me and followee_id = target;
end;
$$;

revoke all on function public.follow_user(text) from public, anon;
revoke all on function public.unfollow_user(text) from public, anon;
grant execute on function public.follow_user(text) to authenticated;
grant execute on function public.unfollow_user(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Bloquear
-- ─────────────────────────────────────────────────────────────────────────────
-- Todas devuelven el id de la fila de bloqueo (lo que usa DELETE /me/blocks/:id).

-- Interna: bloqueo "con nombre". Deshace los seguimientos en ambos sentidos.
create or replace function public.block_named(me uuid, target uuid, p_label text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  block_id uuid;
begin
  insert into public.blocks (blocker_id, blocked_id, via_anonymous, label)
    values (me, target, false, p_label)
    on conflict (blocker_id, blocked_id) where not via_anonymous do nothing
    returning id into block_id;
  if block_id is null then
    select b.id into block_id from public.blocks b
     where b.blocker_id = me and b.blocked_id = target and not b.via_anonymous;
  end if;
  delete from public.follows
   where (follower_id = me and followee_id = target)
      or (follower_id = target and followee_id = me);
  return block_id;
end;
$$;

-- Interna: bloqueo desde algo anónimo. NO toca los seguimientos: deshacer
-- "sigo a Fulano" al bloquear algo anónimo diría que Fulano lo escribió.
create or replace function public.block_anonymous(me uuid, target uuid, p_source text, p_label text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  block_id uuid;
begin
  insert into public.blocks (blocker_id, blocked_id, via_anonymous, source_key, label)
    values (me, target, true, p_source, p_label)
    on conflict (blocker_id, source_key) where source_key is not null do nothing
    returning id into block_id;
  if block_id is null then
    select b.id into block_id from public.blocks b
     where b.blocker_id = me and b.source_key = p_source;
  end if;
  return block_id;
end;
$$;

revoke all on function public.block_named(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.block_anonymous(uuid, uuid, text, text) from public, anon, authenticated;

create or replace function public.block_user(p_public_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target record;
begin
  if me is null then
    raise exception 'sin_sesion' using errcode = 'insufficient_privilege';
  end if;
  select pr.id, pr.display_name into target from public.profiles pr
   where pr.public_id = p_public_id and pr.display_name is not null;
  if target.id is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if target.id = me then
    raise exception 'accion_invalida' using errcode = 'invalid_parameter_value';
  end if;
  return public.block_named(me, target.id, target.display_name);
end;
$$;

create or replace function public.block_post_author(p_post_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  p record;
begin
  if me is null then
    raise exception 'sin_sesion' using errcode = 'insufficient_privilege';
  end if;
  select po.author_id, po.is_anonymous, po.body, coalesce(pr.display_name, po.author_display_name) as name
    into p
    from public.posts po join public.profiles pr on pr.id = po.author_id
   where po.id = p_post_id and (po.status = 'published' or po.author_id = me);
  if p.author_id is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if p.author_id = me then
    raise exception 'accion_invalida' using errcode = 'invalid_parameter_value';
  end if;
  if p.is_anonymous or p.name is null then
    return public.block_anonymous(me, p.author_id, 'post:' || p_post_id, public.excerpt(p.body));
  end if;
  return public.block_named(me, p.author_id, p.name);
end;
$$;

create or replace function public.block_comment_author(p_comment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c record;
begin
  if me is null then
    raise exception 'sin_sesion' using errcode = 'insufficient_privilege';
  end if;
  select co.author_id, co.is_anonymous, co.body, coalesce(pr.display_name, co.author_display_name) as name
    into c
    from public.post_comments co
    join public.posts po on po.id = co.post_id
    join public.profiles pr on pr.id = co.author_id
   where co.id = p_comment_id
     and ((co.status = 'published' and (po.status = 'published' or po.author_id = me))
          or co.author_id = me);
  if c.author_id is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if c.author_id = me then
    raise exception 'accion_invalida' using errcode = 'invalid_parameter_value';
  end if;
  if c.is_anonymous or c.name is null then
    return public.block_anonymous(me, c.author_id, 'comment:' || p_comment_id, public.excerpt(c.body));
  end if;
  return public.block_named(me, c.author_id, c.name);
end;
$$;

revoke all on function public.block_user(text) from public, anon;
revoke all on function public.block_post_author(uuid) from public, anon;
revoke all on function public.block_comment_author(uuid) from public, anon;
grant execute on function public.block_user(text) to authenticated;
grant execute on function public.block_post_author(uuid) to authenticated;
grant execute on function public.block_comment_author(uuid) to authenticated;
