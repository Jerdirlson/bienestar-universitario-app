-- Raíz · correcciones de la revisión de seguridad y privacidad (sep. 2026)
--
-- Idempotente y aplicable sobre una base con datos: solo `create or replace`,
-- `if not exists`, `drop … if exists` y actualizaciones que no fallan si ya
-- se hicieron. No edita las migraciones anteriores; redefine lo que cambia.
--
--   1. Bloquear desde algo ANÓNIMO oculta solo ese contenido (source_key), no
--      todo lo anónimo de su autor.
--   2. Un bloqueo anónimo no se "siente" del otro lado: las reglas inversas
--      solo cuentan bloqueos con nombre.
--   3. Reacciones y "me gusta" notifican sin actor.
--   4. Lo rechazado, quitado u ocultado por reportes se lleva sus
--      notificaciones.
--   5. Registro append-only de publicaciones para los límites de frecuencia.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 y 2. Bloqueos
-- ─────────────────────────────────────────────────────────────────────────────
-- Antes, un bloqueo via_anonymous ocultaba TODO lo anónimo de esa persona.
-- Eso era un oráculo: bloquear una publicación anónima y mirar qué otras
-- publicaciones anónimas daban 404 revelaba cuáles eran de la misma persona.
-- Ahora:
--   · bloqueo con nombre (desde un perfil o algo firmado) → oculta lo que esa
--     persona firma, en ambos sentidos (como antes);
--   · bloqueo desde algo anónimo → oculta SOLO ese contenido (source_key). El
--     resto de lo anónimo de esa persona sigue visible, porque ocultarlo
--     diría que es suyo.
-- hides_content queda solo para lo firmado; lo anónimo se decide por
-- contenido en post_hidden_for_me / comment_hidden_for_me.
--
-- En sentido contrario solo cuentan los bloqueos CON NOMBRE: si un bloqueo
-- anónimo ocultara a quien fue bloqueado lo firmado de quien bloqueó, el
-- autor de lo anónimo notaría qué nombre desapareció y sabría quién lo
-- bloqueó.

create or replace function public.hides_content(viewer uuid, author uuid, is_anon boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer is not null and author is not null and viewer <> author
    and not is_anon
    and exists (
      select 1 from public.blocks b
      where not b.via_anonymous
        and ((b.blocker_id = viewer and b.blocked_id = author)
          or (b.blocker_id = author and b.blocked_id = viewer))
    );
$$;

revoke all on function public.hides_content(uuid, uuid, boolean) from public, anon, authenticated;

-- ¿`viewer` bloqueó ESTE contenido anónimo? ('post:<id>' / 'comment:<id>')
create or replace function public.hides_source(viewer uuid, p_source text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer is not null and exists (
    select 1 from public.blocks b
    where b.blocker_id = viewer and b.source_key = p_source
  );
$$;

revoke all on function public.hides_source(uuid, text) from public, anon, authenticated;

create or replace function public.named_block_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks bl
    where not bl.via_anonymous
      and ((bl.blocker_id = a and bl.blocked_id = b)
        or (bl.blocker_id = b and bl.blocked_id = a))
  );
$$;

revoke all on function public.named_block_between(uuid, uuid) from public, anon, authenticated;

create or replace function public.post_hidden_for_me(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.hides_content(auth.uid(), p.author_id, p.is_anonymous)
        or public.hides_source(auth.uid(), 'post:' || p.id)
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
        or public.hides_source(auth.uid(), 'comment:' || c.id)
    from public.post_comments c
    where c.id = p_comment_id and (c.status = 'published' or c.author_id = auth.uid())
  ), false);
$$;

revoke all on function public.post_hidden_for_me(uuid) from public, anon;
revoke all on function public.comment_hidden_for_me(uuid) from public, anon;
grant execute on function public.post_hidden_for_me(uuid) to authenticated;
grant execute on function public.comment_hidden_for_me(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 y 3. Notificaciones
-- ─────────────────────────────────────────────────────────────────────────────
-- Reglas de notify():
--   · nunca a uno mismo;
--   · con actor visible (comentario firmado, seguir): no si hay un bloqueo
--     con nombre entre ambos — mismas reglas que el feed;
--   · reacciones y "me gusta" (siempre sin actor, sin contenido del actor):
--     no si quien recibe bloqueó a quien actuó de CUALQUIER forma, también
--     desde algo anónimo. Es lo que "silencia" a ese autor, y no revela nada:
--     el aviso no iba a decir de quién era y una reacción no se puede atribuir
--     a nadie mirando la publicación;
--   · un comentario anónimo de alguien bloqueado desde algo anónimo SÍ avisa
--     ("alguien comentó"): el comentario queda visible (el bloqueo anónimo
--     solo oculta su contenido de origen), y un comentario visible sin su
--     aviso diría "este comentario anónimo es de la misma persona que
--     bloqueaste" — justo lo que el punto 1 evita.

create or replace function public.notify(
  p_recipient uuid, p_kind text, p_post uuid, p_comment uuid,
  p_reaction_kind text, p_actor uuid, p_actor_anonymous boolean, p_excerpt text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  visible boolean;
begin
  if p_recipient is null or p_recipient = p_actor then
    return;
  end if;
  if p_actor is not null and public.hides_content(p_recipient, p_actor, p_actor_anonymous) then
    return;
  end if;
  if p_actor is not null and p_kind in ('post_reaction', 'comment_like') and exists (
    select 1 from public.blocks b
     where (b.blocker_id = p_recipient and b.blocked_id = p_actor)
        or (b.blocker_id = p_actor and b.blocked_id = p_recipient and not b.via_anonymous)
  ) then
    return;
  end if;

  -- Tarjeta del actor solo si actuó con nombre y tiene uno.
  visible := p_actor is not null and not p_actor_anonymous and exists (
    select 1 from public.profiles pr where pr.id = p_actor and pr.display_name is not null
  );

  -- Lo mismo, del mismo actor, sin leer: se refresca en vez de apilar
  -- (reaccionar, quitar y volver a reaccionar no manda tres avisos).
  update public.notifications n
     set created_at = now(), reaction_kind = p_reaction_kind
   where n.recipient_id = p_recipient and n.kind = p_kind and n.read_at is null
     and n.post_id is not distinct from p_post
     and n.comment_id is not distinct from p_comment
     and n.actor_id is not distinct from p_actor;
  if found then
    return;
  end if;

  insert into public.notifications
    (recipient_id, kind, post_id, comment_id, reaction_kind, actor_id, actor_visible, excerpt)
  values
    (p_recipient, p_kind, p_post, p_comment, p_reaction_kind, p_actor, visible, public.excerpt(p_excerpt));
end;
$$;

revoke all on function public.notify(uuid, text, uuid, uuid, text, uuid, boolean, text) from public, anon, authenticated;

-- Reaccionar y dar "me gusta" ya no revelan el alias: la app no avisa al
-- reaccionar que quien escribió va a ver quién fue, y nadie espera que un
-- "abrazo" lo firme. Seguir sí muestra a quien sigue (es público por
-- naturaleza: sale en el conteo de seguidores).
create or replace function public.on_post_reaction_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
begin
  select author_id, body into p from public.posts where id = new.post_id;
  perform public.notify(p.author_id, 'post_reaction', new.post_id, null, new.kind,
                        new.user_id, true, p.body);
  return new;
end;
$$;

revoke all on function public.on_post_reaction_notify() from public, anon, authenticated;

create or replace function public.on_comment_like_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  select author_id, post_id, body into c from public.post_comments where id = new.comment_id;
  perform public.notify(c.author_id, 'comment_like', c.post_id, new.comment_id, null,
                        new.user_id, true, c.body);
  return new;
end;
$$;

revoke all on function public.on_comment_like_notify() from public, anon, authenticated;

-- Las que ya existían dejan de mostrar a quien reaccionó.
update public.notifications
   set actor_visible = false
 where kind in ('post_reaction', 'comment_like') and actor_visible;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Lo retirado por moderación se lleva sus notificaciones
-- ─────────────────────────────────────────────────────────────────────────────
-- Un trigger y no el API: así cubre el panel (rechazar, quitar) y el umbral
-- de reportes (triggers de …_report_threshold) con una sola regla. El aviso
-- a su autor (post_rejected, post_hidden, …) no se toca: es de otro tipo y se
-- inserta después.

create or replace function public.on_content_withdrawn_purge_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (new.status in ('rejected', 'removed')
          or (new.status = 'pending' and new.held_reason = 'reports')) then
    return new;
  end if;
  if tg_table_name = 'posts' then
    -- La publicación y todo lo que se hizo sobre ella (sus comentarios,
    -- respuestas y "me gusta" apuntan a ella por post_id).
    delete from public.notifications
     where post_id = new.id
       and kind in ('post_reaction', 'post_comment', 'comment_reply', 'comment_like');
  else
    delete from public.notifications
     where comment_id = new.id
       and kind in ('post_comment', 'comment_reply', 'comment_like');
  end if;
  return new;
end;
$$;

revoke all on function public.on_content_withdrawn_purge_notifications() from public, anon, authenticated;

drop trigger if exists posts_withdrawn_purge_notifications on public.posts;
create trigger posts_withdrawn_purge_notifications
  after update of status, held_reason on public.posts
  for each row execute function public.on_content_withdrawn_purge_notifications();

drop trigger if exists comments_withdrawn_purge_notifications on public.post_comments;
create trigger comments_withdrawn_purge_notifications
  after update of status, held_reason on public.post_comments
  for each row execute function public.on_content_withdrawn_purge_notifications();

-- Lo que ya estaba retirado antes de esta migración.
delete from public.notifications n
 using public.posts p
 where n.post_id = p.id
   and n.kind in ('post_reaction', 'post_comment', 'comment_reply', 'comment_like')
   and (p.status in ('rejected', 'removed') or (p.status = 'pending' and p.held_reason = 'reports'));

delete from public.notifications n
 using public.post_comments c
 where n.comment_id = c.id
   and n.kind in ('post_comment', 'comment_reply', 'comment_like')
   and (c.status in ('rejected', 'removed') or (c.status = 'pending' and c.held_reason = 'reports'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Registro de publicaciones para los límites de frecuencia
-- ─────────────────────────────────────────────────────────────────────────────
-- El límite (10 publicaciones y 30 comentarios por hora) se contaba sobre
-- posts/post_comments: borrar lo publicado devolvía el cupo, así que se podía
-- publicar y borrar sin fin. Este registro no se borra con el contenido.
-- Sin contenido: solo quién, qué tipo y cuándo. Lo escribe un trigger (nadie
-- lo inserta ni lo borra desde el cliente) y cada quien solo ve sus filas —
-- lo justo para que el API cuente dentro de withUser.

create table if not exists public.publication_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('post', 'comment')),
  created_at timestamptz not null default now()
);

create index if not exists publication_events_user_kind_created_idx
  on public.publication_events (user_id, kind, created_at desc);

alter table public.publication_events enable row level security;
revoke all on public.publication_events from anon, authenticated;
grant select on public.publication_events to authenticated;

drop policy if exists publication_events_own_select on public.publication_events;
create policy publication_events_own_select on public.publication_events
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.on_publication_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.publication_events (user_id, kind)
    values (new.author_id, case when tg_table_name = 'posts' then 'post' else 'comment' end);
  -- Solo hace falta la última hora; se poda lo de esa persona de más de un
  -- día para que la tabla no crezca sin fin.
  delete from public.publication_events
   where user_id = new.author_id and created_at < now() - interval '1 day';
  return new;
end;
$$;

revoke all on function public.on_publication_log() from public, anon, authenticated;

drop trigger if exists posts_publication_log on public.posts;
create trigger posts_publication_log
  after insert on public.posts
  for each row execute function public.on_publication_log();

drop trigger if exists comments_publication_log on public.post_comments;
create trigger comments_publication_log
  after insert on public.post_comments
  for each row execute function public.on_publication_log();

-- Sobre una base con datos: lo de la última hora cuenta desde ya. Solo si el
-- registro está vacío (volver a correr esto no duplica).
insert into public.publication_events (user_id, kind, created_at)
select author_id, 'post', created_at from public.posts
 where created_at > now() - interval '1 hour'
   and not exists (select 1 from public.publication_events)
union all
select author_id, 'comment', created_at from public.post_comments
 where created_at > now() - interval '1 hour'
   and not exists (select 1 from public.publication_events);
