-- Raíz · mensajes privados
--
-- Diseño resumido (ver docs/auditoria/competencia.md §4 para el porqué de
-- cada control; la recomendación de esa sección era no abrir DM entre pares
-- en absoluto — este esquema es la alternativa "acotada y mediada" que el
-- producto decidió construir en su lugar, con todos los controles que la
-- literatura de seguridad pide):
--
--   1. Desactivado por defecto (profiles.messages_enabled).
--   2. Solo entre perfiles CON ALIAS que se siguen mutuamente, sin bloqueo,
--      con los mensajes activados en ambos sentidos — todo lo comprueba
--      start_conversation() de una sola vez, igual que follow_user()/
--      block_user() en …_public_functions.
--   3. El primer mensaje ES la solicitud: conversations nace 'pending' y
--      send_message() no deja mandar un segundo mensaje a quien la inició
--      hasta que se acepte.
--   4. El filtro (api/src/moderation.js) corre en el API ANTES de insertar:
--      lo que tiene riesgo de acoso o datos personales nunca llega a esta
--      base — el remitente lo sabe por el error, no por una fila 'pending'
--      escondida. Lo de crisis SÍ se guarda (risk='high'): se entrega.
--   5. Límites de frecuencia con la misma tabla que ya usan posts/comments
--      (publication_events), con dos kinds nuevos.
--   6. Reportar y bloquear: bloquear reutiliza block_user (mismo perfil con
--      nombre); reportar es un insert directo con RLS. El panel de
--      moderación solo entra por moderation_message_context(), que exige un
--      reporte ABIERTO de ese mensaje exacto y dosifica el contexto (hasta 5
--      mensajes alrededor) — nunca el historial completo. Queda en
--      access_audit (bitácora).
--   7. Retención: la borra api/src/messages.js (tarea periódica, igual que
--      las alertas de crisis) — lo que sigue en un caso de reporte abierto
--      se conserva.
--   8. RLS: conversations/messages solo se leen por quienes participan;
--      todas las escrituras van por funciones security definer (como
--      follows/blocks) — authenticated no tiene insert/update directo.
--
-- Idempotente: create table if not exists, create or replace function, drop
-- policy/trigger if exists + create.

-- ─────────────────────────────────────────────────────────────────────────────
-- Preferencia de la persona
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists messages_enabled boolean not null default false;
grant update (messages_enabled) on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- conversations
-- ─────────────────────────────────────────────────────────────────────────────
-- user_a < user_b (orden canónico por uuid) para que el par tenga una sola
-- fila sin importar quién escribió primero — así el índice único de verdad
-- impide dos conversaciones entre las mismas dos personas.

create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  user_a           uuid not null references public.profiles (id) on delete cascade,
  user_b           uuid not null references public.profiles (id) on delete cascade,
  requested_by     uuid not null references public.profiles (id) on delete cascade,
  status           text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  last_message_at  timestamptz,
  check (user_a <> user_b),
  check (user_a < user_b),
  check (requested_by = user_a or requested_by = user_b)
);

create unique index if not exists conversations_pair_unique on public.conversations (user_a, user_b);
create index if not exists conversations_user_a_idx on public.conversations (user_a, last_message_at desc nulls last);
create index if not exists conversations_user_b_idx on public.conversations (user_b, last_message_at desc nulls last);

alter table public.conversations enable row level security;
revoke all on public.conversations from anon, authenticated;
-- Sin insert/update directo: nace y cambia de estado solo por las funciones
-- de más abajo, que ya comprueban todas las reglas de producto.
grant select on public.conversations to authenticated;

drop policy if exists conversations_participant_select on public.conversations;
create policy conversations_participant_select on public.conversations
  for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- messages
-- ─────────────────────────────────────────────────────────────────────────────
-- risk: 'high' es lo único que se guarda con riesgo — lo que el filtro marca
-- como acoso o datos personales nunca se inserta (api/src/messages.js decide
-- ANTES de llamar a send_message). removed_at: moderación puede ocultar un
-- mensaje puntual sin borrar la fila (se conserva para el caso del reporte).

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid not null references public.profiles (id) on delete cascade,
  body             text not null check (char_length(body) between 1 and 1000),
  risk             text not null default 'none' check (risk in ('none', 'high')),
  created_at       timestamptz not null default now(),
  read_at          timestamptz,
  removed_at       timestamptz
);

create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists messages_unread_idx on public.messages (conversation_id) where read_at is null;

alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;

drop policy if exists messages_participant_select on public.messages;
create policy messages_participant_select on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
     where c.id = messages.conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
  ));

-- service_role: purga por retención (api/src/messages.js, cada día) y ocultar
-- un mensaje puntual tras un reporte (api/src/admin.js).
grant select, delete on public.messages to service_role;
grant update (removed_at) on public.messages to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- message_reports
-- ─────────────────────────────────────────────────────────────────────────────
-- Reutiliza public.report_reason (self_harm, harassment, spam, personal_info,
-- other) — mismas categorías que ya usa la comunidad.

create table if not exists public.message_reports (
  id               uuid primary key default gen_random_uuid(),
  message_id       uuid not null references public.messages (id) on delete cascade,
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  reason           public.report_reason not null,
  detail           text check (char_length(detail) <= 1000),
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  resolved_by      uuid references public.profiles (id) on delete set null,

  unique (message_id, reporter_id)
);

create index if not exists message_reports_open_idx on public.message_reports (created_at) where resolved_at is null;

alter table public.message_reports enable row level security;
revoke all on public.message_reports from anon, authenticated;
grant select, insert on public.message_reports to authenticated;

drop policy if exists message_reports_own_select on public.message_reports;
create policy message_reports_own_select on public.message_reports
  for select to authenticated
  using (reporter_id = auth.uid());

-- El panel necesita ver QUÉ hay para triage (motivo, fecha, message_id) sin
-- leer el contenido del mensaje por aquí — el cuerpo solo sale por
-- moderation_message_context(), acotado y con bitácora.
drop policy if exists message_reports_select_moderator on public.message_reports;
create policy message_reports_select_moderator on public.message_reports
  for select to authenticated
  using (public.is_moderator());

-- Reportar: solo quien participa en la conversación, sobre un mensaje que
-- puede ver (la política de select de messages ya lo exige por la FK).
drop policy if exists message_reports_participant_insert on public.message_reports;
create policy message_reports_participant_insert on public.message_reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from public.messages m
        join public.conversations c on c.id = m.conversation_id
       where m.id = message_id and c.id = conversation_id
         and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

grant select on public.message_reports to service_role;
grant update (resolved_at, resolved_by) on public.message_reports to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- bitácora de moderación: enlazar acciones a un mensaje
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.moderation_actions add column if not exists message_id uuid references public.messages (id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Notificaciones de mensajes: 'message_request' y 'new_message'
-- ─────────────────────────────────────────────────────────────────────────────
-- Sin texto del mensaje (excerpt siempre null) — la notificación solo dice
-- que llegó algo, nunca qué. conversation_id deja a la app abrir el chat
-- correcto al tocarla, igual que post_id/comment_id para el resto.

alter table public.notifications add column if not exists conversation_id uuid references public.conversations (id) on delete cascade;
grant select (conversation_id) on public.notifications to authenticated;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'post_reaction', 'post_comment', 'comment_reply', 'comment_like',
    'new_follower', 'post_approved', 'post_rejected', 'post_hidden',
    'comment_approved', 'comment_rejected', 'support_sent',
    'message_request', 'new_message'));

-- Variante de public.notify() para mensajes: sin excerpt nunca, y el
-- deduplicado se hace por conversación (varios mensajes seguidos sin leer no
-- apilan avisos). No comprueba bloqueos: si hay conversación aceptada o
-- solicitud pendiente entre dos personas, ya se comprobó todo al crearla.
create or replace function public.notify_message(p_conversation_id uuid, p_recipient uuid, p_actor uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_recipient is null or p_recipient = p_actor then
    return;
  end if;

  update public.notifications n
     set created_at = now()
   where n.recipient_id = p_recipient and n.kind = p_kind and n.read_at is null
     and n.conversation_id is not distinct from p_conversation_id;
  if found then
    return;
  end if;

  insert into public.notifications (recipient_id, kind, conversation_id, actor_id, actor_visible, excerpt)
    values (p_recipient, p_kind, p_conversation_id, p_actor, true, null);
end;
$$;

revoke all on function public.notify_message(uuid, uuid, uuid, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- límites de frecuencia (misma tabla que posts/comments, dos kinds nuevos)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.publication_events drop constraint if exists publication_events_kind_check;
alter table public.publication_events add constraint publication_events_kind_check
  check (kind in ('post', 'comment', 'message', 'dm_request'));

-- Aparte de on_publication_log (que lee NEW.author_id: no existe en estas dos
-- tablas). Poda a 2 días — el límite más largo que cuenta esto es el de 1
-- día de solicitudes nuevas, con margen.
create or replace function public.on_dm_publication_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid;
  k text;
begin
  if tg_table_name = 'conversations' then
    who := new.requested_by;
    k := 'dm_request';
  else
    who := new.sender_id;
    k := 'message';
  end if;
  insert into public.publication_events (user_id, kind) values (who, k);
  delete from public.publication_events where user_id = who and created_at < now() - interval '2 days';
  return new;
end;
$$;

revoke all on function public.on_dm_publication_log() from public, anon, authenticated;

drop trigger if exists conversations_publication_log on public.conversations;
create trigger conversations_publication_log
  after insert on public.conversations
  for each row execute function public.on_dm_publication_log();

drop trigger if exists messages_publication_log on public.messages;
create trigger messages_publication_log
  after insert on public.messages
  for each row execute function public.on_dm_publication_log();

-- ─────────────────────────────────────────────────────────────────────────────
-- Abrir o crear la conversación
-- ─────────────────────────────────────────────────────────────────────────────
-- Comprueba TODO de una vez: perfil con alias, no yo mismo, mensajes
-- activados por el destino, sin bloqueo con nombre en ningún sentido, y
-- seguimiento mutuo. Si ya existe la conversación (en cualquier estado) la
-- devuelve tal cual — abrir no crea una segunda. `created` le dice al API si
-- debe contar esto contra el límite diario de solicitudes nuevas.

create or replace function public.start_conversation(p_public_id text)
returns table (id uuid, status text, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
  target_enabled boolean;
  a uuid;
  b uuid;
  existing record;
  new_id uuid;
begin
  if me is null then
    raise exception 'sin_sesion' using errcode = 'insufficient_privilege';
  end if;
  -- Nunca desde contenido anónimo: quien escribe también necesita un alias.
  if not exists (select 1 from public.profiles pr where pr.id = me and pr.display_name is not null) then
    raise exception 'falta_nombre' using errcode = 'insufficient_privilege';
  end if;

  select pr.id, pr.messages_enabled into target, target_enabled
    from public.profiles pr
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
  if not coalesce(target_enabled, false) then
    raise exception 'mensajes_desactivados' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = target)
     or not exists (select 1 from public.follows f where f.follower_id = target and f.followee_id = me) then
    raise exception 'no_se_siguen_mutuamente' using errcode = 'insufficient_privilege';
  end if;

  a := least(me, target);
  b := greatest(me, target);

  select c.id, c.status into existing from public.conversations c where c.user_a = a and c.user_b = b;
  if existing.id is not null then
    return query select existing.id, existing.status, false;
    return;
  end if;

  insert into public.conversations (user_a, user_b, requested_by, status)
    values (a, b, me, 'pending')
    returning conversations.id into new_id;

  return query select new_id, 'pending'::text, true;
end;
$$;

revoke all on function public.start_conversation(text) from public, anon;
grant execute on function public.start_conversation(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enviar un mensaje
-- ─────────────────────────────────────────────────────────────────────────────
-- p_risk lo decide el API ANTES de llamar (screen() de moderation.js corrió
-- ya): 'none' o 'high' (crisis). Lo que el filtro retiene por acoso o datos
-- personales JAMÁS llega hasta acá.
--
-- Regla de la solicitud: mientras la conversación siga 'pending', solo quien
-- la inició puede escribir, y una sola vez — el destinatario tiene que
-- aceptar antes de responder.

create or replace function public.send_message(p_conversation_id uuid, p_body text, p_risk text default 'none')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  conv record;
  sent_count int;
  new_id uuid;
  recipient uuid;
  notif_kind text;
begin
  if me is null then
    raise exception 'sin_sesion' using errcode = 'insufficient_privilege';
  end if;
  if p_risk not in ('none', 'high') then
    raise exception 'riesgo_invalido' using errcode = 'invalid_parameter_value';
  end if;

  select * into conv from public.conversations c where c.id = p_conversation_id and (c.user_a = me or c.user_b = me);
  if conv.id is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if conv.status = 'rejected' then
    raise exception 'conversacion_rechazada' using errcode = 'insufficient_privilege';
  end if;
  notif_kind := 'new_message';
  if conv.status = 'pending' then
    if conv.requested_by <> me then
      raise exception 'solicitud_pendiente' using errcode = 'insufficient_privilege';
    end if;
    select count(*) into sent_count from public.messages m where m.conversation_id = p_conversation_id and m.sender_id = me;
    if sent_count >= 1 then
      raise exception 'solicitud_pendiente' using errcode = 'insufficient_privilege';
    end if;
    notif_kind := 'message_request';
  end if;

  insert into public.messages (conversation_id, sender_id, body, risk)
    values (p_conversation_id, me, p_body, p_risk)
    returning messages.id into new_id;

  update public.conversations set last_message_at = now() where id = p_conversation_id;

  recipient := case when conv.user_a = me then conv.user_b else conv.user_a end;
  perform public.notify_message(p_conversation_id, recipient, me, notif_kind);

  return new_id;
end;
$$;

revoke all on function public.send_message(uuid, text, text) from public, anon;
grant execute on function public.send_message(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Aceptar / rechazar la solicitud
-- ─────────────────────────────────────────────────────────────────────────────
-- Solo quien la RECIBIÓ decide — nunca quien la mandó.

create or replace function public.accept_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  conv record;
begin
  if me is null then
    raise exception 'sin_sesion' using errcode = 'insufficient_privilege';
  end if;
  select * into conv from public.conversations c where c.id = p_conversation_id and (c.user_a = me or c.user_b = me);
  if conv.id is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if conv.requested_by = me or conv.status <> 'pending' then
    raise exception 'estado_invalido' using errcode = 'invalid_parameter_value';
  end if;
  update public.conversations set status = 'accepted', accepted_at = now() where id = p_conversation_id;
end;
$$;

create or replace function public.reject_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  conv record;
begin
  if me is null then
    raise exception 'sin_sesion' using errcode = 'insufficient_privilege';
  end if;
  select * into conv from public.conversations c where c.id = p_conversation_id and (c.user_a = me or c.user_b = me);
  if conv.id is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if conv.requested_by = me or conv.status <> 'pending' then
    raise exception 'estado_invalido' using errcode = 'invalid_parameter_value';
  end if;
  update public.conversations set status = 'rejected' where id = p_conversation_id;
end;
$$;

revoke all on function public.accept_conversation(uuid) from public, anon;
revoke all on function public.reject_conversation(uuid) from public, anon;
grant execute on function public.accept_conversation(uuid) to authenticated;
grant execute on function public.reject_conversation(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Marcar leído
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sin_sesion' using errcode = 'insufficient_privilege';
  end if;
  update public.messages m
     set read_at = now()
   where m.conversation_id = p_conversation_id
     and m.read_at is null
     and m.sender_id <> me
     and exists (
       select 1 from public.conversations c
        where c.id = p_conversation_id and (c.user_a = me or c.user_b = me)
     );
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- ¿Puedo escribirle a esta persona? (para el botón del perfil público)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.can_message(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and p_target is not null and p_target <> auth.uid()
    and exists (select 1 from public.profiles pr where pr.id = p_target and pr.messages_enabled and pr.display_name is not null)
    and not public.named_block_between(auth.uid(), p_target)
    and exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p_target)
    and exists (select 1 from public.follows f where f.follower_id = p_target and f.followee_id = auth.uid());
$$;

revoke all on function public.can_message(uuid) from public, anon, authenticated;

-- public_profile gana can_message. Cambia la forma de salida: hay que borrar
-- la función antes de poder recrearla con una columna más.
drop function if exists public.public_profile(text);
create function public.public_profile(p_public_id text)
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
  is_me          boolean,
  can_message    boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pr.public_id, pr.display_name, pr.avatar_emoji, pr.avatar_color, pr.bio, pr.created_at,
    (select count(*)::int from public.posts p
      where p.author_id = pr.id and p.status = 'published' and not p.is_anonymous),
    (select count(*)::int from public.follows f where f.followee_id = pr.id),
    (select count(*)::int from public.follows f where f.follower_id = pr.id),
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = pr.id),
    pr.id = auth.uid(),
    (pr.id <> auth.uid() and public.can_message(pr.id))
  from public.profiles pr
  where pr.public_id = p_public_id
    and pr.display_name is not null
    and auth.uid() is not null
    and (pr.id = auth.uid() or not public.named_block_between(auth.uid(), pr.id));
$$;

revoke all on function public.public_profile(text) from public, anon;
grant execute on function public.public_profile(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tarjeta del otro participante (para el API)
-- ─────────────────────────────────────────────────────────────────────────────
-- author_card(uuid, text) NUNCA se concede a authenticated (recibe un id
-- interno arbitrario: sería un oráculo para desanonimizar, ver
-- …_public_functions.sql). Esta envoltura solo deja pedir la tarjeta del
-- OTRO participante de UNA conversación donde quien pregunta ya participa —
-- nada arbitrario.

create or replace function public.conversation_other(p_conversation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.author_card(case when c.user_a = auth.uid() then c.user_b else c.user_a end, null)
    from public.conversations c
   where c.id = p_conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid());
$$;

revoke all on function public.conversation_other(uuid) from public, anon;
grant execute on function public.conversation_other(uuid) to authenticated;

-- named_block_between(uuid, uuid) tampoco se concede a authenticated por el
-- mismo motivo (recibe ids internos arbitrarios). Misma envoltura: solo para
-- UNA conversación donde quien pregunta ya participa.
create or replace function public.conversation_blocked(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.named_block_between(auth.uid(), case when c.user_a = auth.uid() then c.user_b else c.user_a end)
      from public.conversations c
     where c.id = p_conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
  ), false);
$$;

revoke all on function public.conversation_blocked(uuid) from public, anon;
grant execute on function public.conversation_blocked(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Panel de moderación: contexto acotado de un mensaje reportado
-- ─────────────────────────────────────────────────────────────────────────────
-- Exige un reporte ABIERTO de ESE mensaje exacto — no hay camino para que un
-- moderador navegue conversaciones sin partir de un caso. Devuelve el
-- mensaje reportado y hasta 5 alrededor (por orden cronológico), nunca el
-- historial completo. Dentro de la conversación SÍ identifica a quien envió
-- cada uno (igual que la cola de moderación ve author_display_name de un
-- post anónimo: moderar exige poder distinguir a las dos personas). Deja
-- constancia en access_audit — la bitácora que pide la regla de producto.

create or replace function public.moderation_message_context(p_message_id uuid)
returns table (
  id           uuid,
  body         text,
  created_at   timestamptz,
  removed_at   timestamptz,
  is_reported  boolean,
  sender       jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'no_autorizado' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.message_reports r where r.message_id = p_message_id and r.resolved_at is null) then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;

  select m.conversation_id into conv_id from public.messages m where m.id = p_message_id;

  insert into public.access_audit (actor_id, action, target_table, target_id)
    values (auth.uid(), 'view_reported_conversation', 'messages', p_message_id::text);

  return query
    with ctx as (
      select m.id, m.body, m.created_at, m.removed_at, m.sender_id,
             row_number() over (order by m.created_at) as rn,
             (m.id = p_message_id) as is_target
        from public.messages m
       where m.conversation_id = conv_id
    ),
    target as (select rn from ctx where is_target)
    select c.id, c.body, c.created_at, c.removed_at, c.is_target, public.author_card(c.sender_id, null)
      from ctx c, target t
     where c.rn between t.rn - 3 and t.rn + 2
     order by c.created_at;
end;
$$;

revoke all on function public.moderation_message_context(uuid) from public, anon, authenticated;
grant execute on function public.moderation_message_context(uuid) to authenticated;
