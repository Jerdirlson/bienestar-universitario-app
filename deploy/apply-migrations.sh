#!/usr/bin/env bash
# Aplica el esquema a la base de Raíz.
#
#   ./apply-migrations.sh
#
# Orden: primero la capa de compatibilidad de identidad (deploy/migrations/),
# después el esquema y las políticas (supabase/migrations/). Ese orden importa:
# las políticas usan auth.uid(), que crea la primera.
#
# Idempotente en lo posible, pero NO es un motor de migraciones: no lleva
# registro de qué se aplicó. Para el piloto alcanza; antes de producción con
# datos reales hay que pasar a una herramienta que versione (sqitch, dbmate,
# o el CLI de Supabase).

set -euo pipefail

CONTAINER=raiz-db
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a
DB="${POSTGRES_DB:-raiz}"
USER="${POSTGRES_USER:?falta POSTGRES_USER}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: el contenedor $CONTAINER no está corriendo" >&2
  exit 1
fi

run() {
  echo "→ $(basename "$1")"
  docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -q < "$1"
}

echo "── compatibilidad de identidad ──"
for f in "$HERE"/migrations/*.sql; do run "$f"; done

echo "── esquema y políticas ──"
for f in "$ROOT"/supabase/migrations/*.sql; do run "$f"; done

echo
echo "── verificación ──"
docker exec "$CONTAINER" psql -U "$USER" -d "$DB" -At -c \
  "select 'tablas con RLS activo: ' || count(*)
     from pg_tables t join pg_class c on c.relname = t.tablename
    where t.schemaname = 'public' and c.relrowsecurity;"
docker exec "$CONTAINER" psql -U "$USER" -d "$DB" -At -c \
  "select 'políticas: ' || count(*) from pg_policies where schemaname='public';"
