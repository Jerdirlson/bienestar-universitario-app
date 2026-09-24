#!/usr/bin/env bash
# Restaura la base de Raíz desde un respaldo.
#
#   ./restore.sh /srv/raiz/backups/raiz-20260809-030000.dump
#
# DESTRUCTIVO: reemplaza el contenido actual de la base. Pide confirmación
# explícita salvo que se pase --force.
#
# Este script existe para ser ejecutado en un simulacro, no solo en una
# emergencia. Un respaldo que nunca se restauró no es un respaldo.

set -euo pipefail

CONTAINER=raiz-db
DUMP="${1:?uso: ./restore.sh <archivo.dump> [--force]}"
FORCE="${2:-}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a

DB="${POSTGRES_DB:-raiz}"
USER="${POSTGRES_USER:?falta POSTGRES_USER}"

[ -f "$DUMP" ] || { echo "ERROR: no existe $DUMP" >&2; exit 1; }

# Respaldos cifrados por backup.sh: se descifran a un temporal legible solo
# por quien restaura (umask 077) y que se borra al salir.
#   .dump.gpg → BACKUP_PASSPHRASE     .dump.age → BACKUP_IDENTITY (archivo de clave privada)
umask 077
case "$DUMP" in
  *.gpg|*.age)
    PLAIN="$(mktemp)"
    trap 'rm -f "$PLAIN"' EXIT
    if [ "${DUMP##*.}" = gpg ]; then
      : "${BACKUP_PASSPHRASE:?falta BACKUP_PASSPHRASE para descifrar $DUMP}"
      gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
          --decrypt -o "$PLAIN" "$DUMP" 3<<<"$BACKUP_PASSPHRASE"
    else
      : "${BACKUP_IDENTITY:?falta BACKUP_IDENTITY (clave privada de age) para descifrar $DUMP}"
      age -d -i "$BACKUP_IDENTITY" -o "$PLAIN" "$DUMP"
    fi
    DUMP="$PLAIN"
    ;;
esac

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: el contenedor $CONTAINER no está corriendo" >&2
  exit 1
fi

echo "→ verificando el archivo antes de tocar nada"
docker exec -i "$CONTAINER" pg_restore --list < "$DUMP" > /dev/null

if [ "$FORCE" != "--force" ]; then
  echo
  echo "Se va a REEMPLAZAR el contenido de la base '$DB'."
  echo "Origen: $DUMP"
  read -r -p "Escribe 'restaurar' para continuar: " ans
  [ "$ans" = "restaurar" ] || { echo "cancelado"; exit 1; }
fi

echo "→ restaurando"
# --clean --if-exists borra los objetos existentes antes de recrearlos.
# --single-transaction: si algo falla a mitad, no queda una base a medias.
# --no-owner: los objetos quedan del rol que restaura, no del que volcó.
docker exec -i "$CONTAINER" pg_restore \
  -U "$USER" -d "$DB" \
  --clean --if-exists --no-owner --single-transaction \
  < "$DUMP"

echo "→ comprobando"
docker exec "$CONTAINER" psql -U "$USER" -d "$DB" -At -c \
  "select 'tablas: ' || count(*) from information_schema.tables where table_schema='public';"
docker exec "$CONTAINER" psql -U "$USER" -d "$DB" -At -c \
  "select 'políticas de seguridad: ' || count(*) from pg_policies where schemaname='public';"

echo "→ restauración completa"
