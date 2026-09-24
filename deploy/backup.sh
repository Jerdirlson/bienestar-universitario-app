#!/usr/bin/env bash
# Respaldo de la base de Raíz.
#
#   ./backup.sh [directorio_destino]
#
# Pensado para cron. Escribe un volcado en formato custom de Postgres (ya viene
# comprimido y permite restaurar tablas sueltas), verifica que sea legible,
# lo cifra si hay con qué y rota los antiguos.
#
# El volcado incluye el diario de todo el mundo. La app promete que nadie en
# ella puede leerlo; un .dump legible por cualquier usuario de la máquina, o
# copiado a otro disco tal cual, rompería esa promesa por la puerta de atrás.
# Por eso:
#   · umask 077: el archivo nace legible solo por quien corre el respaldo;
#   · cifrado opcional (ver deploy/README.md, "Respaldos cifrados"):
#       BACKUP_RECIPIENT=age1…    → age, con clave pública (recomendado: la
#                                   clave privada no tiene que estar en la
#                                   máquina para respaldar)
#       BACKUP_PASSPHRASE=…       → gpg --symmetric (AES256)
#     Sin ninguna de las dos, avisa por consola que queda SIN CIFRAR.
#
# Solo toca recursos con prefijo `raiz`. No mira nada del acueducto.

set -euo pipefail
umask 077

CONTAINER=raiz-db
BACKUP_DIR="${1:-/srv/raiz/backups}"
RETENTION_DAYS=14

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a

DB="${POSTGRES_DB:-raiz}"
USER="${POSTGRES_USER:?falta POSTGRES_USER}"
BACKUP_RECIPIENT="${BACKUP_RECIPIENT:-}"
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: el contenedor $CONTAINER no está corriendo" >&2
  exit 1
fi

# Se comprueba ANTES de volcar: si se pidió cifrar y no hay con qué, mejor no
# dejar un volcado en claro en el disco.
if [ -n "$BACKUP_RECIPIENT" ] && ! command -v age >/dev/null 2>&1; then
  echo "ERROR: BACKUP_RECIPIENT está definido pero 'age' no está instalado" >&2
  exit 1
fi
if [ -z "$BACKUP_RECIPIENT" ] && [ -n "$BACKUP_PASSPHRASE" ] && ! command -v gpg >/dev/null 2>&1; then
  echo "ERROR: BACKUP_PASSPHRASE está definido pero 'gpg' no está instalado" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true
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

# Cifrado. El archivo en claro se borra solo si el cifrado salió bien.
if [ -n "$BACKUP_RECIPIENT" ]; then
  echo "→ cifrando con age"
  age -r "$BACKUP_RECIPIENT" -o "$OUT.age" "$OUT"
  rm -f "$OUT"
  OUT="$OUT.age"
elif [ -n "$BACKUP_PASSPHRASE" ]; then
  echo "→ cifrando con gpg (simétrico, AES256)"
  # La frase va por un descriptor, no por argumentos: así no aparece en la
  # lista de procesos.
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
      --symmetric --cipher-algo AES256 -o "$OUT.gpg" "$OUT" 3<<<"$BACKUP_PASSPHRASE"
  rm -f "$OUT"
  OUT="$OUT.gpg"
else
  echo "AVISO: el respaldo queda SIN CIFRAR (contiene el diario de todas las personas)." >&2
  echo "       Definir BACKUP_RECIPIENT (age) o BACKUP_PASSPHRASE (gpg); ver deploy/README.md." >&2
fi

SIZE="$(du -h "$OUT" | cut -f1)"
echo "→ ok: $OUT ($SIZE)"

# Rotación. Solo borra archivos que coincidan con nuestro patrón de nombre.
echo "→ rotando respaldos de más de $RETENTION_DAYS días"
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'raiz-*.dump' -o -name 'raiz-*.dump.gpg' -o -name 'raiz-*.dump.age' \) \
  -mtime "+$RETENTION_DAYS" -print -delete

echo "→ respaldos actuales: $(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'raiz-*.dump' -o -name 'raiz-*.dump.gpg' -o -name 'raiz-*.dump.age' \) | wc -l)"
