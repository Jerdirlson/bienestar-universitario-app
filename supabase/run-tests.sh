#!/usr/bin/env bash
# Aplica las migraciones sobre un Postgres limpio en Docker y corre las pruebas
# de Row Level Security. No toca ninguna base real.
#
#   ./supabase/run-tests.sh
#
# Requiere Docker. En Git Bash sobre Windows, MSYS_NO_PATHCONV evita que las
# rutas /tmp del contenedor se conviertan a rutas de Windows.

set -euo pipefail
# MSYS_NO_PATHCONV evita que Git Bash reescriba las rutas /tmp/... del
# CONTENEDOR como si fueran rutas de Windows. Pero el mismo interruptor deja
# de convertir también la ruta del ARCHIVO EN EL HOST que le pasamos a
# `docker cp`, y el docker.exe nativo de Windows no entiende `/c/Users/...` —
# de ahí "GetFileAttributesEx C:\c: ..." si se le pasa tal cual. cp_host()
# resuelve las dos cosas a la vez: convierte la ruta del host con cygpath
# (si existe; en Linux/macOS no hace falta y se usa tal cual) y dispara
# docker cp con MSYS_NO_PATHCONV activo solo para esa llamada.
cp_host() {
  local host_path="$1" dest="$2"
  if command -v cygpath >/dev/null 2>&1; then
    host_path="$(cygpath -w "$host_path")"
  fi
  MSYS_NO_PATHCONV=1 docker cp "$host_path" "$dest"
}

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

run() { MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" psql -U postgres -d raiz -v ON_ERROR_STOP=1 -q -f "$1"; }

cp_host "$HERE/tests/00_supabase_shim.sql" "$CONTAINER:/tmp/shim.sql"
run /tmp/shim.sql

for f in "$HERE"/migrations/*.sql; do
  echo "aplicando $(basename "$f")"
  cp_host "$f" "$CONTAINER:/tmp/m.sql"
  run /tmp/m.sql
done

# Cada archivo de pruebas en orden (00 es el shim, ya aplicado arriba). Si
# uno falla, ON_ERROR_STOP corta todo y el script sale con error.
for f in "$HERE"/tests/[0-9][0-9]_*.sql; do
  case "$(basename "$f")" in 00_*) continue ;; esac
  echo "probando $(basename "$f")"
  cp_host "$f" "$CONTAINER:/tmp/tests.sql"
  run /tmp/tests.sql
done
