#!/usr/bin/env bash
# Aplica las migraciones sobre un Postgres limpio en Docker y corre las pruebas
# de Row Level Security. No toca ninguna base real.
#
#   ./supabase/run-tests.sh
#
# Requiere Docker. En Git Bash sobre Windows, MSYS_NO_PATHCONV evita que las
# rutas /tmp del contenedor se conviertan a rutas de Windows.

set -euo pipefail
export MSYS_NO_PATHCONV=1

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER=raiz-pgtest
IMAGE=postgres:16-alpine

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cleanup
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=raiz "$IMAGE" >/dev/null

printf 'esperando a postgres'
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d raiz >/dev/null 2>&1; then
    echo ' listo'; break
  fi
  printf '.'; sleep 1
done

run() { docker exec "$CONTAINER" psql -U postgres -d raiz -v ON_ERROR_STOP=1 -q -f "$1"; }

docker cp "$HERE/tests/00_supabase_shim.sql" "$CONTAINER:/tmp/shim.sql"
run /tmp/shim.sql

for f in "$HERE"/migrations/*.sql; do
  echo "aplicando $(basename "$f")"
  docker cp "$f" "$CONTAINER:/tmp/m.sql"
  run /tmp/m.sql
done

docker cp "$HERE/tests/01_rls_tests.sql" "$CONTAINER:/tmp/tests.sql"
run /tmp/tests.sql
