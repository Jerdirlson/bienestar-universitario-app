-- Raíz · esquema inicial
--
-- Principio que gobierna todo el diseño: SEUDONIMIZACIÓN.
-- Ninguna tabla de contenido guarda nombre ni correo institucional. Todo se
-- referencia contra profiles.id, que es el identificador opaco que entrega el
-- proveedor de identidad. Quien obtenga una copia de `entries` no puede saber
-- de quién es sin cruzar contra auth.users, que vive aparte.
--
-- Las políticas de acceso están en la migración siguiente (…_row_level_security).
-- Esta solo crea estructura.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Perfiles
-- ─────────────────────────────────────────────────────────────────────────────

create type public.user_role as enum ('student', 'moderator', 'professional', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  -- Alias elegido por la persona. NO es el nombre institucional: la comunidad
  -- es anónima y el nombre real nunca debe llegar a una tabla de contenido.
  display_name text check (char_length(display_name) between 2 and 40),
  role        public.user_role not null default 'student',
  locale      text not null default 'es' check (locale in ('es', 'en')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Un perfil por cuenta. display_name es un alias, nunca el nombre institucional.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Check-ins diarios
-- ─────────────────────────────────────────────────────────────────────────────

create table public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,

  -- Día calendario en la zona horaria de la persona, resuelto en el cliente.
  -- Un registro por día: si vuelve a registrar, se actualiza el mismo.
  entry_date  date not null,

  mood        smallint not null check (mood between 0 and 4),

  -- Claves estables ('tranquile', 'estudios'…), no las etiquetas traducidas:
  -- así el idioma se puede cambiar sin reescribir el histórico.
  feelings    text[] not null default '{}',
  causes      text[] not null default '{}',

  note        text check (char_length(note) <= 4000),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, entry_date)
);

comment on column public.entries.note is
  'Texto libre del diario. El dato más sensible de la aplicación: ninguna política '
  'permite que otra persona lo lea, moderadores incluidos.';

create index entries_user_date_idx on public.entries (user_id, entry_date desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Retos
-- ─────────────────────────────────────────────────────────────────────────────

create table public.challenges (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  title_es    text not null,
  title_en    text not null,
  total_days  smallint not null check (total_days > 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.user_challenges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  started_at    timestamptz not null default now(),
  completed_days smallint not null default 0 check (completed_days >= 0),
  completed_at  timestamptz,

  unique (user_id, challenge_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Comunidad anónima
-- ─────────────────────────────────────────────────────────────────────────────

-- Nada se publica solo. Toda publicación nace 'pending' y necesita pasar por el
-- clasificador y, si hay riesgo, por revisión humana. El valor por defecto es
-- deliberado: si el clasificador falla o no corre, el contenido NO aparece.
create type public.post_status as enum ('pending', 'published', 'rejected', 'removed');

-- Nivel de riesgo que asigna el clasificador automático. 'high' nunca se publica
-- sin que una persona lo revise y active el protocolo de escalamiento.
create type public.risk_level as enum ('unscreened', 'none', 'low', 'high');

create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles (id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 2000),
  mood          smallint check (mood between 0 and 4),

  status        public.post_status not null default 'pending',
  risk          public.risk_level not null default 'unscreened',
  screened_at   timestamptz,
  -- Qué vio el clasificador. Se guarda para poder auditar y afinar la rúbrica.
  screening_note text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index posts_published_idx
  on public.posts (created_at desc)
  where status = 'published';

-- Cola de moderación: lo pendiente y lo riesgoso primero.
create index posts_queue_idx
  on public.posts (risk desc, created_at)
  where status = 'pending';

create table public.post_reactions (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create type public.report_reason as enum
  ('self_harm', 'harassment', 'spam', 'personal_info', 'other');

create table public.post_reports (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  reason       public.report_reason not null,
  detail       text check (char_length(detail) <= 1000),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles (id) on delete set null,

  -- Una persona reporta una publicación una sola vez.
  unique (post_id, reporter_id)
);

create index post_reports_open_idx
  on public.post_reports (created_at)
  where resolved_at is null;

create type public.moderation_action as enum
  ('publish', 'reject', 'remove', 'escalate', 'dismiss_report');

create table public.moderation_actions (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid references public.posts (id) on delete set null,
  moderator_id uuid not null references public.profiles (id) on delete set null,
  action       public.moderation_action not null,
  note         text,
  created_at   timestamptz not null default now()
);

comment on table public.moderation_actions is
  'Bitácora de moderación. Append-only: ninguna política permite update ni delete.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Auditoría de acceso a datos sensibles
-- ─────────────────────────────────────────────────────────────────────────────

-- Sin acceso desde el cliente: solo la service_role escribe aquí. Existe para
-- poder responder "¿quién leyó qué?" ante la SIC o una auditoría interna.
create table public.access_audit (
  id          bigserial primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  target_table text not null,
  target_id   text,
  created_at  timestamptz not null default now()
);

create index access_audit_actor_idx on public.access_audit (actor_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at automático
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger entries_touch before update on public.entries
  for each row execute function public.touch_updated_at();

create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Alta automática de perfil
-- ─────────────────────────────────────────────────────────────────────────────

-- Se dispara cuando el proveedor de identidad crea la cuenta. No copia correo
-- ni nombre: solo enlaza el identificador opaco.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
