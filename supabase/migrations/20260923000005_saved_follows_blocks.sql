-- Raíz · guardados, seguimientos y bloqueos
--
-- Las tres tablas son personales: cada quien ve solo lo suyo. Nadie —ni
-- moderación ni administración— tiene política para ver lo guardado, a quién
-- sigue o a quién bloqueó otra persona.
--
-- El punto delicado es BLOQUEAR AL AUTOR DE ALGO ANÓNIMO sin revelar quién
-- es. Si bloquear desde una publicación anónima ocultara también lo que esa
-- persona publica con su nombre, bastaría con mirar qué nombre desaparece del
-- feed para saber quién escribió lo anónimo. Por eso un bloqueo recuerda
-- desde dónde se hizo (via_anonymous) y oculta solo "del mismo lado":
--
--   · bloqueo desde un perfil o algo con nombre → oculta lo que esa persona
--     firma con su nombre. Lo anónimo suyo sigue visible (ocultarlo diría
--     cuáles publicaciones anónimas son suyas).
--   · bloqueo desde algo anónimo → oculta lo anónimo de esa persona. Lo que
--     firma con su nombre sigue visible, y los seguimientos no se tocan.
--   · en sentido contrario, quien fue bloqueado deja de ver lo que firma con
--     nombre quien lo bloqueó (lo anónimo de quien bloquea sigue visible, por
--     la misma razón).
--
-- blocked_id NUNCA es legible desde el cliente (grant por columnas): con él
-- se podría cruzar contra posts.author_id y saber de quién era lo anónimo.

-- ─────────────────────────────────────────────────────────────────────────────
-- saved_posts
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.saved_posts (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists saved_posts_user_created_idx on public.saved_posts (user_id, created_at desc);

alter table public.saved_posts enable row level security;
revoke all on public.saved_posts from anon, authenticated;
grant select, insert, delete on public.saved_posts to authenticated;

drop policy if exists saved_own_select on public.saved_posts;
create policy saved_own_select on public.saved_posts
  for select to authenticated
  using (user_id = auth.uid());

-- Solo se guarda lo que se puede ver: la subconsulta pasa por las políticas
-- de posts de quien guarda.
drop policy if exists saved_own_insert on public.saved_posts;
create policy saved_own_insert on public.saved_posts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id)
  );

drop policy if exists saved_own_delete on public.saved_posts;
create policy saved_own_delete on public.saved_posts
  for delete to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- follows
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;
-- Sin insert directo: seguir pasa por public.follow_user(public_id), que
-- resuelve el public_id sin entregarle a nadie el id interno de otra persona.
grant select, delete on public.follows to authenticated;

-- Solo a quién sigo yo. A quién me sigue se cuenta con funciones, sin
-- entregar filas con ids ajenos.
drop policy if exists follows_own_select on public.follows;
create policy follows_own_select on public.follows
  for select to authenticated
  using (follower_id = auth.uid());

drop policy if exists follows_own_delete on public.follows;
create policy follows_own_delete on public.follows
  for delete to authenticated
  using (follower_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- blocks
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.blocks (
  id            uuid primary key default gen_random_uuid(),
  blocker_id    uuid not null references public.profiles (id) on delete cascade,
  blocked_id    uuid not null references public.profiles (id) on delete cascade,
  -- true si se bloqueó desde algo anónimo. Ver el encabezado.
  via_anonymous boolean not null default false,
  -- De dónde salió un bloqueo anónimo ('post:<id>' / 'comment:<id>'), para
  -- que bloquear dos veces lo mismo no duplique. Cada bloqueo anónimo es su
  -- propia fila: si dos bloqueos desde contenidos distintos se fundieran en
  -- uno, quien bloquea sabría que ambos contenidos son de la misma persona.
  source_key    text,
  -- Lo que se muestra en "personas bloqueadas": el alias si se bloqueó desde
  -- algo con nombre, o un extracto del contenido si era anónimo. Nunca el
  -- alias de un autor anónimo.
  label         text not null check (char_length(label) between 1 and 200),
  created_at    timestamptz not null default now(),
  check (blocker_id <> blocked_id)
);

create unique index if not exists blocks_named_unique
  on public.blocks (blocker_id, blocked_id) where not via_anonymous;
create unique index if not exists blocks_source_unique
  on public.blocks (blocker_id, source_key) where source_key is not null;
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
-- Por columnas: blocked_id y source_key no se entregan nunca al cliente.
-- Bloquear pasa por funciones (public.block_*), no por insert directo.
grant select (id, blocker_id, via_anonymous, label, created_at) on public.blocks to authenticated;
grant delete on public.blocks to authenticated;

drop policy if exists blocks_own_select on public.blocks;
create policy blocks_own_select on public.blocks
  for select to authenticated
  using (blocker_id = auth.uid());

drop policy if exists blocks_own_delete on public.blocks;
create policy blocks_own_delete on public.blocks
  for delete to authenticated
  using (blocker_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Ayudantes internos de bloqueo
-- ─────────────────────────────────────────────────────────────────────────────
-- Reciben ids internos, así que NO se conceden a nadie: solo los usan otras
-- funciones security definer y los triggers. Si authenticated pudiera
-- llamarlos con ids arbitrarios, serían un oráculo para desanonimizar.

-- ¿Debe `viewer` dejar de ver algo de `author` que es anónimo o no según
-- `is_anon`? Las reglas del encabezado, en una sola consulta.
create or replace function public.hides_content(viewer uuid, author uuid, is_anon boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer is not null and author is not null and viewer <> author and exists (
    select 1 from public.blocks b
    where (b.blocker_id = viewer and b.blocked_id = author and b.via_anonymous = is_anon)
       or (b.blocker_id = author and b.blocked_id = viewer and not is_anon)
  );
$$;

revoke all on function public.hides_content(uuid, uuid, boolean) from public, anon, authenticated;

-- ¿Hay un bloqueo "con nombre" entre ambas personas, en cualquier sentido?
-- Es lo que oculta un perfil público y lo que impide seguirse.
create or replace function public.named_block_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b and not bl.via_anonymous)
       or (bl.blocker_id = b and bl.blocked_id = a)
  );
$$;

revoke all on function public.named_block_between(uuid, uuid) from public, anon, authenticated;
