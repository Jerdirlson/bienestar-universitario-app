-- Raíz · códigos de acceso por correo
--
-- El SSO institucional de la UPB está pendiente (trámite aparte, no código).
-- Mientras tanto, el login real usa un código de un solo uso enviado al correo
-- @upb.edu.co de la persona — no una cuenta anónima, para que la identidad sí
-- quede atada a un correo institucional verificado.
--
-- Vive en el esquema `auth`, no en `public`, por la misma razón que auth.users:
-- es información que identifica a la persona, y las tablas de contenido no
-- deben poder cruzarse contra ella sin pasar por acá.
--
-- El código nunca se guarda en claro — solo su hash — para que una fuga de
-- esta tabla no entregue códigos válidos, igual que no se guardaría una
-- contraseña en claro.
--
-- Sin Row Level Security: no hace falta. A esta tabla solo la toca el rol
-- `anon` desde las rutas /auth del API (nunca `authenticated`, nunca el
-- cliente vía PostgREST — no usamos PostgREST), así que el control de acceso
-- es el grant mismo, igual que en auth.users.

create table auth.access_codes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    int not null default 0,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

comment on table auth.access_codes is
  'Códigos de un solo uso para el login por correo institucional. El código '
  'en claro nunca se guarda ni se loguea — solo su hash.';

-- Para encontrar rápido "el código vigente más reciente de este correo", que
-- es la única consulta que hace el API sobre esta tabla.
create index access_codes_email_created_idx
  on auth.access_codes (email, created_at desc);

-- auth_compat.sql le da `usage on schema auth` a authenticated y service_role,
-- pero no a anon — hasta ahora nada de anon tocaba directamente el esquema
-- auth. Sin esto, cualquier consulta de anon a auth.access_codes falla con
-- "permission denied for schema auth" antes siquiera de llegar a la tabla.
grant usage on schema auth to anon;

grant select, insert, update on auth.access_codes to anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- Alta de cuenta al verificar el código
-- ─────────────────────────────────────────────────────────────────────────────

-- Encuentra o crea la cuenta por correo y devuelve su id. security definer
-- para que anon NO necesite ningún grant directo sobre auth.users — es la
-- única tabla del sistema donde alguien es identificable (ver auth_compat.sql),
-- y select/insert/update ahí abiertos a un rol sin sesión son más superficie
-- de la que este flujo necesita. Esta función es la única puerta.
create or replace function auth.find_or_create_user(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
begin
  insert into auth.users (email, last_seen_at) values (p_email, now())
    on conflict (email) do update set last_seen_at = now()
    returning id into result_id;
  return result_id;
end;
$$;

comment on function auth.find_or_create_user(text) is
  'Puerta única para tocar auth.users desde /auth/verify-code, antes de que '
  'exista sesión. anon no tiene ningún grant directo sobre auth.users.';

revoke all on function auth.find_or_create_user(text) from public;
grant execute on function auth.find_or_create_user(text) to anon;
-- Sin delete: los códigos vencidos o usados se quedan como rastro de
-- auditoría (intentos, hora). Limpiarlos es tarea de mantenimiento aparte,
-- no algo que el flujo de login necesite hacer.
