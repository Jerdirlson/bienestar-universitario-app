#!/usr/bin/env bash
# Crea el rol con el que se conecta la aplicación, y comprueba que las políticas
# de seguridad realmente le apliquen.
#
#   APP_DB_PASSWORD='...' ./create-app-role.sh
#
# Por qué existe
# --------------
# El usuario del .env (POSTGRES_USER) es DUEÑO de las tablas, y en Postgres el
# dueño no está sujeto a Row Level Security. Si la app se conectara con él,
# las 21 políticas del esquema quedarían anuladas y cualquiera podría leer el
# diario de cualquiera.
#
# `raiz_app` no es dueño de nada y no tiene bypassrls. Solo puede asumir el rol
# `authenticated`, que es al que apuntan las políticas.
#
# Idempotente: se puede correr de nuevo para rotar la contraseña.

set -euo pipefail

CONTAINER=raiz-db
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a

DB="${POSTGRES_DB:-raiz}"
OWNER="${POSTGRES_USER:?falta POSTGRES_USER}"
APP_USER="${APP_DB_USER:-raiz_app}"
APP_PASS="${APP_DB_PASSWORD:?falta APP_DB_PASSWORD (genera una: openssl rand -hex 32 — no -base64, va dentro de una URL de conexión)}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: el contenedor $CONTAINER no está corriendo" >&2
  exit 1
fi

psql_owner() { docker exec -i "$CONTAINER" psql -U "$OWNER" -d "$DB" -v ON_ERROR_STOP=1 "$@"; }

echo "── creando/actualizando el rol $APP_USER ──"
# La contraseña se pasa por variable de psql para que no quede en el historial
# del shell ni en la lista de procesos del host.
psql_owner -q -v app="$APP_USER" -v pass="$APP_PASS" <<'SQL'
-- Crea el rol solo si no existe. \gexec ejecuta el texto que devuelve el select.
select 'create role ' || quote_ident(:'app') || ' login'
 where not exists (select 1 from pg_roles where rolname = :'app')
\gexec

alter role :"app" with login password :'pass' nosuperuser nocreatedb nocreaterole noinherit nobypassrls;

-- noinherit es deliberado: el rol NO obtiene los permisos de authenticated
-- automáticamente. Tiene que pedirlos con `set role` en cada transacción, lo
-- que hace explícito en el código cuándo se está actuando en nombre de alguien.
--
-- service_role está acá por pragmatismo de piloto, no por diseño original:
-- row_level_security.sql anticipa un "backend de moderación" aparte, más
-- privilegiado y aislado del API que habla con el teléfono. Mientras no
-- exista ese segundo servicio, raiz-api hace las dos cosas — moderar sigue
-- exigiendo pasar primero por is_moderator() en el código (ver api/src/posts.js),
-- así que esto no abre la puerta por sí solo, pero si el API completo se
-- compromete, service_role queda alcanzable. Separar esto es un pendiente
-- real antes de manejar datos de estudiantes reales, no un detalle menor.
grant anon, authenticated, service_role to :"app";

grant usage on schema public to :"app";
grant usage on schema auth   to :"app";
SQL

echo "── comprobando que NO pueda saltarse la seguridad ──"

# Datos de prueba, como dueño (bypassa RLS a propósito para sembrar).
psql_owner -q <<'SQL'
insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000001', 'verif-a@upb.edu.co'),
  ('cccccccc-0000-0000-0000-000000000002', 'verif-b@upb.edu.co')
on conflict (id) do nothing;

insert into public.entries (user_id, entry_date, mood, note) values
  ('cccccccc-0000-0000-0000-000000000001', '2026-01-01', 3, 'diario de A'),
  ('cccccccc-0000-0000-0000-000000000002', '2026-01-01', 3, 'diario de B')
on conflict (user_id, entry_date) do nothing;
SQL

psql_app() {
  docker exec -i -e PGPASSWORD="$APP_PASS" "$CONTAINER" \
    psql -h 127.0.0.1 -U "$APP_USER" -d "$DB" -v ON_ERROR_STOP=1 -At "$@"
}

fallos=0
check() { # nombre esperado obtenido
  if [ "$2" = "$3" ]; then
    echo "  ok    $1"
  else
    echo "  FALLO $1 — esperaba '$2', obtuve '$3'"; fallos=$((fallos+1))
  fi
}

# 1. Sin asumir authenticated no debe poder leer nada. Como el rol es NOINHERIT,
#    no hereda los permisos de `authenticated`, así que Postgres deniega antes
#    siquiera de evaluar las políticas. Falla cerrado, que es lo que queremos.
got=$(psql_app -c "select count(*) from public.entries;" 2>/dev/null || echo "denegado")
check "sin set role no puede leer" "denegado" "$got"

# 2 y 3. Como authenticated y con la identidad de A: ve exactamente una entrada,
#        y es la suya. Se marca el resultado con un prefijo porque psql también
#        imprime la salida de set_config y del COMMIT.
como_a() {
  psql_app <<SQL | grep '^RESULT=' | sed 's/^RESULT=//'
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000001"}', true);
$1
commit;
SQL
}

check "como A ve exactamente 1 entrada" "1" \
  "$(como_a "select 'RESULT=' || count(*) from public.entries;")"

check "y es su propio diario" "diario de A" \
  "$(como_a "select 'RESULT=' || note from public.entries;")"

# 4. El rol no debe tener atributos peligrosos.
got=$(psql_owner -At -c "select rolsuper::text||'/'||rolbypassrls::text from pg_roles where rolname='$APP_USER';")
check "no es superusuario ni bypassrls" "false/false" "$got"

# 5. No debe ser dueño de ninguna tabla (el dueño ignora RLS).
got=$(psql_owner -At -c "select count(*) from pg_tables where schemaname='public' and tableowner='$APP_USER';")
check "no es dueño de ninguna tabla" "0" "$got"

# Limpieza de los datos de verificación.
psql_owner -q -c "delete from auth.users where email like 'verif-%@upb.edu.co';"

echo
if [ "$fallos" -eq 0 ]; then
  echo "✓ rol $APP_USER listo y sujeto a las políticas de seguridad"
  echo
  echo "Cadena de conexión para el backend (la contraseña va en SU .env, no en este):"
  echo "  postgresql://$APP_USER:<contraseña>@raiz-db:5432/$DB"
else
  echo "✗ $fallos comprobación(es) fallaron — NO usar este rol todavía" >&2
  exit 1
fi
