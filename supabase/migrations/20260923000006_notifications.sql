-- Raíz · notificaciones
--
-- Las crean triggers security definer (reacciones, comentarios, "me gusta",
-- seguimientos, umbral de reportes) y el API como service_role (resultado de
-- la moderación). Nadie las inserta desde el cliente.
--
-- Anonimato: actor_id guarda quién actuó, porque hace falta para no
-- notificar a alguien de su propia acción ni de alguien con quien hay un
-- bloqueo. Pero NO es legible desde el cliente (grant por columnas) y la
-- tarjeta pública del actor solo se entrega si actuó con su nombre
-- (actor_visible) — ver public.notification_actor() en …_public_functions.
-- Un comentario anónimo notifica "alguien comentó", nunca quién.

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind in (
                  'post_reaction', 'post_comment', 'comment_reply', 'comment_like',
                  'new_follower', 'post_approved', 'post_rejected', 'post_hidden',
                  'comment_approved', 'comment_rejected')),
  post_id       uuid references public.posts (id) on delete cascade,
  comment_id    uuid references public.post_comments (id) on delete cascade,
  reaction_kind text check (reaction_kind in ('abrazo', 'fuerza', 'te_entiendo', 'inspira')),
  actor_id      uuid references public.profiles (id) on delete cascade,
  actor_visible boolean not null default false,
  -- Extracto corto de lo que motivó la notificación, para mostrarla sin otra
  -- consulta. Es contenido que quien recibe ya podía ver.
  excerpt       text check (char_length(excerpt) <= 140),
  created_at    timestamptz not null default now(),
  read_at       timestamptz
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;

-- Por columnas: actor_id no se entrega al cliente. Lo único editable es
-- marcar como leída.
grant select (id, recipient_id, kind, post_id, comment_id, reaction_kind, actor_visible, excerpt, created_at, read_at)
  on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists notifications_own_select on public.notifications;
create policy notifications_own_select on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- El API notifica el resultado de la moderación (post_approved, …) y limpia
-- las notificaciones de algo que se quitó.
grant select, insert, delete on public.notifications to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Crear una notificación (interno)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.excerpt(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when char_length(t) > 100 then left(t, 99) || '…' else t end;
$$;

-- Centraliza las reglas: nunca a uno mismo, nunca si quien recibe no vería lo
-- que la originó por un bloqueo (mismas reglas que el feed, así la ausencia
-- de una notificación no delata nada que el feed no delate ya), y sin
-- duplicados de lo mismo sin leer.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- Reacción a una publicación → a quien la escribió.
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
                        new.user_id, false, p.body);
  return new;
end;
$$;

revoke all on function public.on_post_reaction_notify() from public, anon, authenticated;

drop trigger if exists post_reactions_notify on public.post_reactions;
create trigger post_reactions_notify
  after insert on public.post_reactions
  for each row execute function public.on_post_reaction_notify();

-- Comentario que QUEDA PUBLICADO (al pasar el filtro o al aprobarlo un
-- administrador) → a quien escribió la publicación, y si es respuesta, a
-- quien escribió el comentario de arriba. Lo retenido no notifica: nadie más
-- que su autor lo puede ver todavía.
create or replace function public.on_comment_published_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_author uuid;
  parent_author uuid;
begin
  if new.status <> 'published' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' then
    return new;
  end if;
  -- Si ya se notificó una vez (fue ocultado por reportes y volvió), no otra.
  if exists (select 1 from public.notifications n
              where n.comment_id = new.id and n.kind in ('post_comment', 'comment_reply')) then
    return new;
  end if;

  select author_id into post_author from public.posts where id = new.post_id;

  if new.parent_id is not null then
    select author_id into parent_author from public.post_comments where id = new.parent_id;
    perform public.notify(parent_author, 'comment_reply', new.post_id, new.id, null,
                          new.author_id, new.is_anonymous, new.body);
  end if;

  if post_author is distinct from parent_author then
    perform public.notify(post_author, 'post_comment', new.post_id, new.id, null,
                          new.author_id, new.is_anonymous, new.body);
  end if;
  return new;
end;
$$;

revoke all on function public.on_comment_published_notify() from public, anon, authenticated;

drop trigger if exists post_comments_notify on public.post_comments;
create trigger post_comments_notify
  after insert or update of status on public.post_comments
  for each row execute function public.on_comment_published_notify();

-- "Me gusta" en un comentario → a quien lo escribió.
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
                        new.user_id, false, c.body);
  return new;
end;
$$;

revoke all on function public.on_comment_like_notify() from public, anon, authenticated;

drop trigger if exists comment_likes_notify on public.comment_likes;
create trigger comment_likes_notify
  after insert on public.comment_likes
  for each row execute function public.on_comment_like_notify();

-- Nuevo seguidor → a quien empiezan a seguir.
create or replace function public.on_follow_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify(new.followee_id, 'new_follower', null, null, null,
                        new.follower_id, false, null);
  return new;
end;
$$;

revoke all on function public.on_follow_notify() from public, anon, authenticated;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert on public.follows
  for each row execute function public.on_follow_notify();
