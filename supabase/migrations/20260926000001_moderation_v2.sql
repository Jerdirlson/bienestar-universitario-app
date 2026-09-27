-- Raíz · moderación v2: rol moderador real, protocolo de crisis y apelación
--
-- Idempotente y aplicable sobre una base con datos: solo `add column if not
-- exists`, `drop constraint if exists` + `add constraint`, y
-- `alter type ... add value if not exists`. No reescribe migraciones
-- anteriores.
--
--   1. Apelación: quien escribió algo rechazado puede pedir UNA revisión más
--      (API: POST /posts/:id/appeal y POST /posts/comments/:id/appeal). Vuelve
--      a 'pending' con held_reason = 'appeal'. appealed_at queda puesto para
--      siempre — es lo que impide una segunda apelación, incluso si se
--      rechaza otra vez.
--   2. Protocolo de crisis: "enviar apoyo" (una vez, sin revelar identidad al
--      moderador — lo resuelve el API con service_role) y "marcar como
--      atendido" con una nota interna que NUNCA sale en el contrato del
--      cliente (no se agrega a POST_SELECT/COMMENT_SELECT en community.js).
--   3. is_moderator() y las políticas *_select_moderator ya existían (mira
--      row_level_security.sql) y ya alcanzaban para leer la cola y los
--      reportes — este archivo no toca RLS, solo agrega columnas y valores de
--      enum para lo que faltaba a nivel de esquema.

-- ─────────────────────────────────────────────────────────────────────────────
-- held_reason: nuevo motivo 'appeal'
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.posts drop constraint if exists posts_held_reason_check;
alter table public.posts add constraint posts_held_reason_check
  check (held_reason in ('crisis', 'review', 'reports', 'appeal'));

alter table public.post_comments drop constraint if exists post_comments_held_reason_check;
alter table public.post_comments add constraint post_comments_held_reason_check
  check (held_reason in ('crisis', 'review', 'reports', 'appeal'));

-- ─────────────────────────────────────────────────────────────────────────────
-- moderation_action: nuevos valores para la bitácora del protocolo de crisis
-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER TYPE ... ADD VALUE no se puede usar en la MISMA transacción en la que
-- se compara ese valor — este archivo solo lo agrega, nunca lo usa, así que
-- corre sin problema dentro de la transacción que aplica esta migración
-- (apply-migrations.sh / supabase/run-tests.sh).

alter type public.moderation_action add value if not exists 'support_sent';
alter type public.moderation_action add value if not exists 'crisis_handled';

-- ─────────────────────────────────────────────────────────────────────────────
-- Columnas del protocolo de crisis y de apelación
-- ─────────────────────────────────────────────────────────────────────────────
-- appealed_at: sale en el contrato del cliente (columna `appealed`, ver
--   community.js) porque el autor necesita saber si ya usó su única apelación.
-- support_sent_at / crisis_handled_*: NUNCA salen en POST_SELECT/COMMENT_SELECT
--   — son de uso exclusivo del panel de moderación (admin.js). No hace falta
--   ningún grant nuevo: authenticated y service_role ya tienen select/update
--   de tabla completa sobre posts/post_comments (row_level_security.sql,
--   community_v2.sql); lo que decide qué columna sale al cliente es el SELECT
--   explícito del API, no el grant de Postgres.

alter table public.posts
  add column if not exists appealed_at timestamptz,
  add column if not exists support_sent_at timestamptz,
  add column if not exists crisis_handled_at timestamptz,
  add column if not exists crisis_handled_by uuid references public.profiles (id) on delete set null,
  add column if not exists crisis_handled_note text
    check (char_length(crisis_handled_note) <= 500);

alter table public.post_comments
  add column if not exists appealed_at timestamptz,
  add column if not exists support_sent_at timestamptz,
  add column if not exists crisis_handled_at timestamptz,
  add column if not exists crisis_handled_by uuid references public.profiles (id) on delete set null,
  add column if not exists crisis_handled_note text
    check (char_length(crisis_handled_note) <= 500);

-- service_role es quien mueve estas columnas (moderar sigue siendo cosa de
-- service_role, igual que el resto — ver row_level_security.sql).
grant update (appealed_at, support_sent_at, crisis_handled_at, crisis_handled_by, crisis_handled_note)
  on public.posts to service_role;
grant update (appealed_at, support_sent_at, crisis_handled_at, crisis_handled_by, crisis_handled_note)
  on public.post_comments to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications.kind: 'support_sent'
-- ─────────────────────────────────────────────────────────────────────────────
-- Aviso cálido al autor de algo retenido por crisis, sin actor y sin excerpt
-- (ver api/src/admin.js) — no debe poder reconstruirse qué escribió ni quién
-- se lo mandó.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'post_reaction', 'post_comment', 'comment_reply', 'comment_like',
    'new_follower', 'post_approved', 'post_rejected', 'post_hidden',
    'comment_approved', 'comment_rejected', 'support_sent'));
