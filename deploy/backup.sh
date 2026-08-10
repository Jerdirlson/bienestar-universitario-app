#!/usr/bin/env bash
# Respaldo de la base de Raíz.
#
#   ./backup.sh [directorio_destino]
#
# Pensado para cron. Escribe un volcado en formato custom de Postgres (ya viene
# comprimido y permite restaurar tablas sueltas), verifica que sea legible y
# rota los antiguos.
#
# Solo toca recursos con prefijo `raiz`. No mira nada del acueducto.

set -euo pipefail

CONTAINER=raiz-db
BACKUP_DIR="${1:-/srv/raiz/backups}"
RETENTION_DAYS=14

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a

DB="${POSTGRES_DB:-raiz}"
USER="${POSTGRES_USER:?falta POSTGRES_USER}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: el contenedor $CONTAINER no está corriendo" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/raiz-$STAMP.dump"

echo "→ volcando $DB"
# -Fc = formato custom: comprimido y restaurable de forma selectiva.
# La contraseña no viaja por la línea de comandos; se toma del entorno del
# contenedor, así que no queda en el historial ni en la lista de procesos.
docker exec "$CONTAINER" pg_dump -U "$USER" -d "$DB" -Fc > "$OUT"

# Un archivo que no se puede leer no es un respaldo. Verificamos antes de
# considerarlo bueno y antes de rotar los anteriores.
echo "→ verificando"
if ! docker exec -i "$CONTAINER" pg_restore --list < "$OUT" > /dev/null 2>&1; then
  echo "ERROR: el volcado no es legible; se conserva para diagnóstico y NO se rota" >&2
  mv "$OUT" "$OUT.corrupto"
  exit 1
fi

SIZE="$(du -h "$OUT" | cut -f1)"
echo "→ ok: $OUT ($SIZE)"

# Rotación. Solo borra archivos que coincidan con nuestro patrón de nombre.
echo "→ rotando respaldos de más de $RETENTION_DAYS días"
find "$BACKUP_DIR" -maxdepth 1 -name 'raiz-*.dump' -type f -mtime "+$RETENTION_DAYS" -print -delete

echo "→ respaldos actuales: $(find "$BACKUP_DIR" -maxdepth 1 -name 'raiz-*.dump' | wc -l)"
