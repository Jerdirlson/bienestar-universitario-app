#!/usr/bin/env bash
# Prueba la capa de datos del API contra un Postgres real y efímero.
#
#   bash api/run-tests.sh                              todas las pruebas
#   bash api/run-tests.sh tests/journal-v2.test.mjs    solo algunas
#
# Levanta la base con la superposición de pruebas (que publica el puerto solo en
# 127.0.0.1), aplica el esquema, crea el rol de aplicación y corre las pruebas.
# Requiere Docker. No toca ninguna base real.

set -euo pipefail

FILES=("$@")
export MSYS_NO_PATHCONV=1

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="$(cd "$HERE/.." && pwd)/deploy"

OWNER_USER=raiz_admin
OWNER_PASS=pruebas-locales
APP_USER=raiz_app
APP_PASS=pruebas-locales-app
DB=raiz
PORT=15432

cd "$DEPLOY"
cat > .env <<EOF
POSTGRES_DB=$DB
POSTGRES_USER=$OWNER_USER
POSTGRES_PASSWORD=$OWNER_PASS
APP_DB_USER=$APP_USER
APP_DB_PASSWORD=$APP_PASS
JWT_SECRET=solo-para-pruebas
EOF

cleanup() {
  docker compose -f docker-compose.yml -f docker-compose.test.yml down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

echo "── levantando Postgres ──"
# Solo el servicio db: estas pruebas corren la lógica del API directo en Node,
# contra Postgres — no necesitan el contenedor raiz-api armado ni JWT_SECRET.
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d db >/dev/null
for _ in $(seq 1 60); do
  [ "$(docker inspect --format='{{.State.Health.Status}}' raiz-db 2>/dev/null)" = "healthy" ] && break
  sleep 1
done

echo "── aplicando esquema ──"
bash apply-migrations.sh | tail -3

echo "── creando rol de aplicación ──"
APP_DB_PASSWORD="$APP_PASS" bash create-app-role.sh | grep -E "ok|FALLO|✓|✗"

echo
echo "── pruebas del API ──"
cd "$HERE"
[ -d node_modules ] || npm install --silent
[ ${#FILES[@]} -eq 0 ] && FILES=(tests/*.test.mjs)

# Un archivo a la vez: todos comparten la misma base, y el feed pagina de a
# 20 — pruebas en paralelo podrían empujar la publicación que se busca fuera
# de la primera página. Los límites de frecuencia se suben porque las pruebas
# crean mucho contenido con pocas cuentas; tests/limits.test.mjs los baja a
# los valores reales para probarlos.
OWNER_DATABASE_URL="postgresql://$OWNER_USER:$OWNER_PASS@127.0.0.1:$PORT/$DB" \
DATABASE_URL="postgresql://$APP_USER:$APP_PASS@127.0.0.1:$PORT/$DB" \
JWT_SECRET=solo-para-pruebas \
RATE_LIMIT_POSTS_PER_HOUR=10000 \
RATE_LIMIT_COMMENTS_PER_HOUR=10000 \
  node --test --test-concurrency=1 "${FILES[@]}"
