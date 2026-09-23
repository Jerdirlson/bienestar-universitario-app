-- Raíz · diario libre
--
-- Además del check-in diario (`entries`, uno por día), la app tiene un diario
-- libre: varias entradas por día, con título, texto y una pregunta guía
-- opcional (prompt_key).
--
-- Misma regla que `entries`, sin excepciones: SOLO su dueño lo lee y lo
-- escribe. No hay política para moderadores ni administradores, no hay grant
-- para service_role y el contenido nunca pasa por el filtro de moderación —
-- el servidor no analiza lo que alguien escribe para sí. Si algún día hiciera
-- falta acceso clínico, tiene que ser un flujo aparte, consentido y
-- registrado en access_audit (ver row_level_security.sql).
--
-- El id lo genera el cliente (uuid v4) para poder crear entradas sin conexión
-- y sincronizarlas después con un upsert idempotente.

create table if not exists public.journal_entries (
  id          uuid primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text check (char_length(title) <= 120),
  body        text not null check (char_length(body) between 1 and 10000),
  -- Clave estable de la pregunta guía, no su texto: igual que feelings y
  -- causes en `entries`, así se puede traducir sin reescribir el histórico.
  prompt_key  text check (char_length(prompt_key) <= 40),
  mood        smallint check (mood between 0 and 4),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.journal_entries is
  'Diario libre. Tan privado como entries: ninguna política permite que otra '
  'persona lo lea, moderadores y administradores incluidos.';

create index if not exists journal_entries_user_created_idx
  on public.journal_entries (user_id, created_at desc);

drop trigger if exists journal_entries_touch on public.journal_entries;
create trigger journal_entries_touch before update on public.journal_entries
  for each row execute function public.touch_updated_at();

alter table public.journal_entries enable row level security;

-- En Supabase las tablas nuevas de `public` reciben permisos por defecto para
-- anon y authenticated. Se quitan explícitamente y se concede solo lo justo.
revoke all on public.journal_entries from anon, authenticated;
grant select, insert, update, delete on public.journal_entries to authenticated;

drop policy if exists journal_own_select on public.journal_entries;
create policy journal_own_select on public.journal_entries
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists journal_own_insert on public.journal_entries;
create policy journal_own_insert on public.journal_entries
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists journal_own_update on public.journal_entries;
create policy journal_own_update on public.journal_entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists journal_own_delete on public.journal_entries;
create policy journal_own_delete on public.journal_entries
  for delete to authenticated
  using (user_id = auth.uid());
