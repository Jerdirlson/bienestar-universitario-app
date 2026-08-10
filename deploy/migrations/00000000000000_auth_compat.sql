-- Capa de compatibilidad de identidad para Postgres autoalojado.
--
-- Las migraciones de `supabase/migrations/` usan `auth.users` y `auth.uid()`,
-- que en Supabase vienen dados. Aquí los creamos nosotros para poder correr el
-- mismo esquema sobre un Postgres normal, sin arrastrar los ~8 contenedores de
-- Supabase autoalojado a una máquina de 3.8 GB compartida con otro proyecto.
--
-- Se aplica ANTES que las migraciones del esquema. En un proyecto de Supabase
-- real este archivo NO se aplica: allá el esquema `auth` ya existe.
--
-- Cómo funciona en producción
-- ---------------------------
-- El backend valida el token del proveedor de identidad de la UPB y, en cada
-- petición, dentro de una transacción, hace:
--
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<uuid del usuario>"}', true);
--
-- A partir de ahí `auth.uid()` devuelve ese uuid y todas las políticas de
-- seguridad del esquema funcionan igual que en Supabase.
--
-- ⚠️ El `true` final de set_config es obligatorio: hace el ajuste local a la
-- transacción. Sin él, el valor persiste en la conexión y —con un pool de
-- conexiones— la siguiente petición heredaría la identidad de la anterior.
-- Sería una fuga de datos entre usuarios.

create extension if not exists "pgcrypto";

create schema if not exists auth;

-- Cuentas. Deliberadamente mínima: aquí vive el vínculo con el proveedor de
-- identidad y nada más. Ningún dato de contenido referencia esta tabla
-- directamente — todo pasa por public.profiles, que solo guarda el id opaco.
create table if not exists auth.users (
  id           uuid primary key default gen_random_uuid(),
  -- Identificador que entrega el proveedor de identidad de la UPB (claim `sub`).
  external_sub text unique,
  -- Correo institucional. Vive AQUÍ y en ningún otro lado: es el único punto
  -- donde una persona es identificable. Las tablas de contenido no lo tocan.
  email        text unique,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

comment on table auth.users is
  'Identidad. Único lugar del sistema donde un usuario es identificable. '
  'Separado de public.profiles a propósito: una copia de las tablas de '
  'contenido no permite saber de quién son los datos sin cruzar contra aquí.';

-- Devuelve el usuario de la petición en curso, o null si no hay sesión.
-- stable, no immutable: depende del ajuste de la transacción.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
$$;

-- Roles equivalentes a los de Supabase, para que las políticas del esquema
-- (que conceden a `authenticated`) apliquen sin cambios.
do $$
begin
  -- anon: sin sesión. No se le concede nada; existe para poder denegar explícito.
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;

  -- authenticated: el rol bajo el que corre toda petición de una persona.
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  -- service_role: PASA POR ENCIMA DE TODAS LAS POLÍTICAS.
  -- Solo el backend de moderación. Nunca la app, nunca el cliente.
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to authenticated, service_role;
grant select on auth.users   to service_role;

-- El rol de la aplicación puede asumir los tres. Se crea aparte, en el
-- despliegue, porque lleva contraseña.
