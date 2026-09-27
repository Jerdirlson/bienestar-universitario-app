-- Raíz · alertas de crisis a moderadores, dentro de la app
--
-- Idempotente: solo `drop constraint if exists` + `add constraint`, igual que
-- …_moderation_v2.sql. No reescribe migraciones anteriores.
--
-- Hasta ahora la alerta de "hay crisis esperando" solo salía por correo
-- (api/src/alerts.js → api/src/mailer.js), y sin SMTP configurado eso es
-- solo una línea de log que nadie ve. Se agrega el tipo de notificación
-- `moderation_alert` para que la misma alerta llegue también a la campanita
-- de cada moderador/administrador dentro de la app.
--
-- Sin actor y sin excerpt (igual que `support_sent`): el texto es genérico,
-- nunca lleva contenido de lo retenido ni identifica a quien lo escribió —
-- lo arma la app a partir de `kind` (ver src/i18n/social.js). El API
-- (api/src/alerts.js) decide cuándo insertarla y no crea una nueva si el
-- moderador ya tiene una sin leer, para no llenar la campanita.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'post_reaction', 'post_comment', 'comment_reply', 'comment_like',
    'new_follower', 'post_approved', 'post_rejected', 'post_hidden',
    'comment_approved', 'comment_rejected', 'support_sent',
    'message_request', 'new_message', 'moderation_alert'));
