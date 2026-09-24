#!/usr/bin/env bash
# Aplica el esquema a la base de Raíz, llevando registro de qué ya se aplicó.
#
#   ./apply-migrations.sh                 aplica solo las migraciones nuevas
#   ./apply-migrations.sh --baseline      base que ya existía ANTES del registro:
#                                         marca como aplicadas las migraciones
#                                         hasta 20260814 (sin correrlas) y
#                                         después aplica las nuevas
#   ./apply-migrations.sh --baseline-until=<archivo.sql>
#                                         igual, pero marcando hasta ese archivo
#   ./apply-migrations.sh --status        muestra qué está aplicado y qué no
#
# Orden: primero la capa de compatibilidad de identidad (deploy/migrations/),
# después el esquema y las políticas (supabase/migrations/). Ese orden importa:
# las políticas usan auth.uid(), que crea la primera.
#
# Registro: raiz_meta.schema_migrations, en un esquema aparte de `public` a
# propósito — ni anon ni authenticated tienen uso sobre él, así que no aparece
# ni se puede tocar desde el API. Cada migración corre en UNA transacción junto
# con su fila de registro: o queda aplicada y registrada, o ninguna de las dos.
#
# Por qué existe --baseline: hasta septiembre de 2026 este script re-aplicaba
# todo en cada corrida, y las primeras migraciones (create type, create table
# sin "if not exists") no se pueden volver a correr sobre una base con datos.
# Una base creada con el script viejo tiene esas migraciones aplicadas pero
# ningún registro; --baseline las registra sin ejecutarlas. Sobre una base
# con esquema y sin registro, el script se NIEGA a seguir sin --baseline, en
# vez de intentar re-crear tablas encima de datos reales.

set -euo pipefail

CONTAINER=raiz-db
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

# Última migración que existía antes del registro. Todo lo que ordena antes o
# igual que esto se considera "ya aplicado" en modo --baseline.
DEFAULT_BASELINE_UNTIL="20260814000007_admin_user_grants.sql"

MODE=apply
BASELINE_UNTIL=""
for arg in "$@"; do
  case "$arg" in
    --baseline) MODE=baseline; BASELINE_UNTIL="$DEFAULT_BASELINE_UNTIL" ;;
    --baseline-until=*) MODE=baseline; BASELINE_UNTIL="${arg#*=}" ;;
    --status) MODE=status ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "argumento desconocido: $arg (ver --help)" >&2; exit 2 ;;
  esac
done

[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a
DB="${POSTGRES_DB:-raiz}"
USER="${POSTGRES_USER:?falta POSTGRES_USER}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: el contenedor $CONTAINER no está corriendo" >&2
  exit 1
fi

# PGOPTIONS: sin los NOTICE de "ya existe, se omite" que llenan la salida.
# El descriptor 3 en los bucles de abajo existe porque docker exec -i se come
# la entrada estándar: sin él, el primer psql del bucle consume la lista de
# migraciones y el bucle termina después de la primera.
psql_q() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER" psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }
psql_at() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTAINER" psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -At "$@"; }

checksum() { sha256sum "$1" | cut -d' ' -f1; }

# Lista ordenada de migraciones como "<nombre de registro>|<ruta>". El nombre
# lleva prefijo de carpeta para que la capa de compatibilidad no choque con
# una migración del esquema que algún día se llame igual.
list_migrations() {
  for f in "$HERE"/migrations/*.sql; do echo "deploy/$(basename "$f")|$f"; done
  for f in "$ROOT"/supabase/migrations/*.sql; do echo "supabase/$(basename "$f")|$f"; done
}

# ── registro ────────────────────────────────────────────────────────────────

psql_q <<'SQL'
create schema if not exists raiz_meta;
revoke all on schema raiz_meta from public;
create table if not exists raiz_meta.schema_migrations (
  filename   text primary key,
  checksum   text not null,
  applied_at timestamptz not null default now(),
  -- 'applied' = se ejecutó aquí; 'baseline' = se marcó como ya aplicada por
  -- el script viejo, sin ejecutarla.
  how        text not null default 'applied' check (how in ('applied', 'baseline'))
);
SQL

registered="$(psql_at -c "select filename from raiz_meta.schema_migrations order by filename;")"
is_registered() { grep -qxF "$1" <<<"$registered"; }

if [ "$MODE" = status ]; then
  while IFS='|' read -r name path <&3; do
    if is_registered "$name"; then
      stored="$(psql_at -c "select checksum from raiz_meta.schema_migrations where filename = '$name';")"
      if [ "$stored" != "$(checksum "$path")" ]; then
        echo "  modificada  $name   (cambió después de aplicarse)"
      else
        echo "  aplicada    $name"
      fi
    else
      echo "  PENDIENTE   $name"
    fi
  done 3< <(list_migrations)
  exit 0
fi

# ¿Base con esquema pero sin registro? Es una base del script viejo.
if [ -z "$registered" ] && [ "$MODE" = apply ]; then
  existing="$(psql_at -c "select to_regclass('public.profiles') is not null;")"
  if [ "$existing" = "t" ]; then
    cat >&2 <<EOF
ERROR: esta base ya tiene el esquema de Raíz pero no tiene registro de
migraciones (se creó con la versión anterior de este script).

Correr una vez:   bash apply-migrations.sh --baseline

Eso marca como aplicadas las migraciones hasta $DEFAULT_BASELINE_UNTIL
(sin ejecutarlas) y después aplica solo las nuevas. Ver deploy/README.md.
EOF
    exit 1
  fi
fi

if [ "$MODE" = baseline ]; then
  if ! list_migrations | cut -d'|' -f1 | grep -q "/$BASELINE_UNTIL\$"; then
    echo "ERROR: --baseline-until apunta a un archivo que no existe: $BASELINE_UNTIL" >&2
    exit 1
  fi
  # Antes de marcar NADA, se comprueba que cada migración a marcar dejó de
  # verdad su objeto centinela (deploy/baseline-sentinels.sh). Marcar sin
  # comprobar sobre una base a medias dejaría huecos que el registro daría
  # por cubiertos para siempre.
  . "$HERE/baseline-sentinels.sh"
  echo "── comprobando que la base de verdad tiene lo que se va a marcar ──"
  missing=()
  while IFS='|' read -r name path <&3; do
    base="$(basename "$path")"
    if [[ ! "$base" > "$BASELINE_UNTIL" ]] && ! is_registered "$name"; then
      if ! expr="$(sentinel_for "$base")"; then
        missing+=("$name (no tiene centinela en baseline-sentinels.sh)")
        continue
      fi
      ok="$(psql_at -c "select coalesce(($expr), false);")"
      if [ "$ok" = "t" ]; then
        echo "  ✓ $name"
      else
        missing+=("$name")
      fi
    fi
  done 3< <(list_migrations)
  if [ ${#missing[@]} -gt 0 ]; then
    {
      echo "ERROR: --baseline se niega a marcar como aplicadas migraciones que esta"
      echo "base NO tiene (falta su objeto centinela):"
      for m in "${missing[@]}"; do echo "  ✗ $m"; done
      echo
      echo "No se marcó nada. Revisar la base: si quedó a medias, aplicar a mano lo"
      echo "que falta o usar --baseline-until=<archivo.sql> con la última migración"
      echo "que de verdad tiene. Ver deploy/README.md."
    } >&2
    exit 1
  fi

  echo "── marcando como ya aplicadas (hasta $BASELINE_UNTIL) ──"
  while IFS='|' read -r name path <&3; do
    base="$(basename "$path")"
    # Orden lexicográfico = orden de aplicación (prefijo de fecha). La capa
    # de compatibilidad (00000000…) siempre queda dentro.
    if [[ ! "$base" > "$BASELINE_UNTIL" ]] && ! is_registered "$name"; then
      psql_q -c "insert into raiz_meta.schema_migrations (filename, checksum, how)
                 values ('$name', '$(checksum "$path")', 'baseline');"
      echo "  ✓ $name"
    fi
  done 3< <(list_migrations)
  registered="$(psql_at -c "select filename from raiz_meta.schema_migrations order by filename;")"
fi

# ── aplicar lo pendiente ────────────────────────────────────────────────────

echo "── migraciones pendientes ──"
applied=0
while IFS='|' read -r name path <&3; do
  if is_registered "$name"; then
    continue
  fi
  echo "→ $name"
  # Una transacción: el archivo y su fila de registro. ON_ERROR_STOP hace que
  # un fallo aborte antes del commit, y la transacción se revierte entera.
  {
    echo "begin;"
    cat "$path"
    echo
    echo "insert into raiz_meta.schema_migrations (filename, checksum) values ('$name', '$(checksum "$path")');"
    echo "commit;"
  } | psql_q
  applied=$((applied + 1))
done 3< <(list_migrations)
[ "$applied" -eq 0 ] && echo "  (nada nuevo)"

echo
echo "── verificación ──"
psql_at -c \
  "select 'tablas con RLS activo: ' || count(*)
     from pg_tables t join pg_class c on c.relname = t.tablename
      and c.relnamespace = 'public'::regnamespace
    where t.schemaname = 'public' and c.relrowsecurity;"
psql_at -c \
  "select 'políticas: ' || count(*) from pg_policies where schemaname='public';"
psql_at -c \
  "select 'migraciones registradas: ' || count(*) from raiz_meta.schema_migrations;"
