-- Raíz · tiempo real y notificaciones push
--
-- Dos piezas, cada una con su propio motivo:
--
-- 1. Canal en tiempo real (api/src/realtime.js, WebSocket /ws). El API
--    necesita enterarse EN EL MOMENTO en que se inserta una notificación o un
--    mensaje, sin importar quién la insertó — un trigger security definer, y
--    triggers de comentarios/reacciones/seguidores) o el propio API como
--    service_role (alerts.js, admin.js). En vez de tocar cada uno de esos
--    puntos, se engancha UNA sola vez en la tabla misma: un trigger AFTER
--    INSERT hace pg_notify(), y api/src/realtime.js mantiene una conexión
--    LISTEN dedicada que reparte el aviso al socket del usuario correcto.
--    El payload nunca lleva contenido — solo el destinatario, el tipo y,
--    para mensajes, la conversación (igual disciplina que notify()/broadcast-
--    QueueChanged: "algo cambió, volvé a pedirlo por HTTP con tu sesión").
--
-- 2. Push (api/src/push.js) para cuando la app está cerrada y no hay socket.
--    push_tokens guarda el Expo push token de cada dispositivo que dio
--    permiso; el dueño lo lee y escribe por RLS, igual que cualquier otra
--    tabla de esta persona. Un interruptor por usuario (profiles.push_enabled)
--    lo apaga sin borrar los tokens.

-- ─────────────────────────────────────────────────────────────────────────────
-- Interruptor "Notificaciones push", en Perfil
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists push_enabled boolean not null default true;
grant update (push_enabled) on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- push_tokens
-- ─────────────────────────────────────────────────────────────────────────────
-- Un token de Expo por fila; una persona puede tener varios (varios
-- teléfonos, o reinstalar sin que el viejo se borre). No hay excerpt, ni
-- contenido: es solo la dirección a la que tocar para avisar.

create table if not exists public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- El dueño registra y borra su propio token (login / logout). Sin update:
-- no hay nada que editar en un token, se borra y se vuelve a mandar.
grant select, insert, delete on public.push_tokens to authenticated;

drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- El API (api/src/push.js) lee los tokens de un destinatario para mandar el
-- push, y borra los que Expo reporte como DeviceNotRegistered. bypassrls no
-- alcanza sin este grant explícito (mismo motivo que moderation_grants.sql).
grant select, delete on public.push_tokens to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger único: cualquier notificación nueva avisa por tiempo real
-- ─────────────────────────────────────────────────────────────────────────────
-- No importa si la insertó un trigger de la base (reacciones, comentarios,
-- seguidores, mensajes) o el API como service_role (admin.js, alerts.js):
-- todas pasan por esta tabla, así que enganchar aquí cubre TODOS los tipos,
-- incluidos moderation_alert, support_sent, new_message y message_request,
-- sin tocar cada punto de inserción por separado.
--
-- El payload de pg_notify nunca sale de este servidor (solo lo lee la
-- conexión LISTEN del propio API) y aun así se mantiene mínimo: destinatario,
-- tipo de notificación (para elegir el texto genérico del push) y la
-- conversación cuando aplica — nunca excerpt ni actor.

create or replace function public.raiz_notify_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_notify('raiz_events', jsonb_build_object(
    'kind', 'notification',
    'recipient_id', new.recipient_id,
    'notification_kind', new.kind,
    'conversation_id', new.conversation_id
  )::text);
  return new;
end;
$$;

revoke all on function public.raiz_notify_notification() from public, anon, authenticated;

drop trigger if exists notifications_realtime on public.notifications;
create trigger notifications_realtime
  after insert on public.notifications
  for each row execute function public.raiz_notify_notification();

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger de mensajes: refresca al instante una conversación ya ABIERTA
-- ─────────────────────────────────────────────────────────────────────────────
-- Distinto del anterior a propósito: notify_message() deduplica (varios
-- mensajes seguidos sin leer no apilan notificaciones), pero quien tiene el
-- chat abierto necesita enterarse de CADA mensaje, no solo del primero. Por
-- eso este trigger vive en public.messages, no depende de si se creó fila en
-- notifications, y nunca dispara push (eso ya lo cubre el trigger de arriba,
-- a través de notify_message insertando en notifications la primera vez).

create or replace function public.raiz_notify_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
begin
  select case when c.user_a = new.sender_id then c.user_b else c.user_a end into recipient
    from public.conversations c where c.id = new.conversation_id;

  if recipient is not null then
    perform pg_notify('raiz_events', jsonb_build_object(
      'kind', 'message',
      'recipient_id', recipient,
      'conversation_id', new.conversation_id
    )::text);
  end if;
  return new;
end;
$$;

revoke all on function public.raiz_notify_message() from public, anon, authenticated;

drop trigger if exists messages_realtime on public.messages;
create trigger messages_realtime
  after insert on public.messages
  for each row execute function public.raiz_notify_message();
