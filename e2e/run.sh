#!/usr/bin/env bash
# Suite e2e permanente de Raíz: levanta todo lo que la app necesita —
# Postgres de prueba, API, la web compilada y el panel de administración —
# corre @playwright/test contra ello y SIEMPRE lo baja al terminar, pase lo
# que pase (trap). Mismo Postgres efímero que api/run-tests.sh (mismo
# compose, mismo puerto 15432): api/run-tests.sh y supabase/run-tests.sh
# pueden correr justo después, cuando este ya bajó el contenedor.
#
#   npm run e2e                        toda la suite
#   npm run e2e -- specs/sos.spec.mjs  solo un archivo (se le pasa a playwright)
#   PW_HEADED=1 npm run e2e            con navegador visible, para depurar
#   PW_CHANNEL='' npm run e2e          sin Edge instalado: usa el Chromium
#                                      que instale `npx playwright install`
set -euo pipefail
# (Sin MSYS_NO_PATHCONV: se necesita la conversión normal de rutas para que
# node.exe reciba rutas de Windows válidas — con ella desactivada, una ruta
# como /c/Users/... se le pasa literal y Windows la entiende como
# "C:\c\Users\..." dentro de la unidad actual.)

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
DEPLOY="$ROOT/deploy"
API_DIR="$ROOT/api"
ADMIN_DIR="$ROOT/admin-web"
# Fuera del repo (que vive bajo OneDrive) a propósito: el export de la web
# escribe muchos archivos chicos (fuentes, bundle) y OneDrive los sincroniza
# mientras se escriben — eso volvía la corrida intermitente (directorio
# "desaparecía" a medias). /tmp en Git Bash apunta al TEMP real de Windows.
TMP="/tmp/raiz-e2e"
rm -rf "$TMP"
mkdir -p "$TMP"

OWNER_USER=raiz_admin
OWNER_PASS=pruebas-locales
APP_USER=raiz_app
APP_PASS=pruebas-locales-app
DB=raiz
DB_PORT=15432
API_PORT=3000
WEB_PORT=8081
ADMIN_PORT=5173

API_PID=""
WEB_PID=""
ADMIN_PID=""
ENV_MOVED=""

log() { echo "── $* ──"; }

# Mata lo que esté escuchando en un puerto por PID de Windows, no por el PID
# que bash cree haber lanzado. En Git Bash, `kill $!` sobre un proceso nativo
# (node.exe) en background muchas veces mata el envoltorio de MSYS y no el
# proceso real — quedaba un servidor viejo escuchando y la siguiente corrida
# le hablaba a él sin darse cuenta (así se sirvió una web con la
# EXPO_PUBLIC_API_URL de una corrida anterior, con el mismo puerto "libre").
kill_port() {
  local port="$1" pid
  # || true en cada etapa: con `set -e -o pipefail`, un grep sin resultados
  # (nada escuchando en el puerto — el caso normal) devuelve 1 y tumbaría
  # todo el script al asignar la sustitución de comandos.
  pid="$( (netstat -ano 2>/dev/null || true) | (grep -E ":$port[[:space:]]" || true) | (grep LISTENING || true) | awk '{print $NF}' | sort -u | head -1)"
  if [ -n "${pid:-}" ] && [ "$pid" != "0" ]; then
    taskkill //PID "$pid" //F >/dev/null 2>&1 || true
  fi
  return 0
}

cleanup() {
  code=$?
  log "bajando todo"
  [ -n "$WEB_PID" ] && kill "$WEB_PID" >/dev/null 2>&1 || true
  [ -n "$ADMIN_PID" ] && kill "$ADMIN_PID" >/dev/null 2>&1 || true
  [ -n "$API_PID" ] && kill "$API_PID" >/dev/null 2>&1 || true
  kill_port "$WEB_PORT"; kill_port "$ADMIN_PORT"; kill_port "$API_PORT"
  # Primero que nada: devolver el .env real de desarrollo a su lugar. Sin esto,
  # una corrida interrumpida deja al proyecto sin su EXPO_PUBLIC_API_URL de
  # verdad (el túnel para probar en el teléfono).
  [ -n "$ENV_MOVED" ] && mv -f "$ROOT/.env.e2e-bak" "$ROOT/.env" 2>/dev/null || true
  (cd "$DEPLOY" && docker compose -f docker-compose.yml -f docker-compose.test.yml down -v >/dev/null 2>&1) || true
  exit $code
}
trap cleanup EXIT INT TERM

# Por si una corrida anterior se interrumpió a la mala y dejó algo vivo en
# estos puertos (kill_port de ahora en más se encarga en cada salida, pero
# esta es la red de seguridad para lo que quedó de antes de tener esa red).
kill_port "$WEB_PORT"; kill_port "$ADMIN_PORT"; kill_port "$API_PORT"

# ── Postgres de prueba ───────────────────────────────────────────────────
cd "$DEPLOY"
cat > .env <<EOF
POSTGRES_DB=$DB
POSTGRES_USER=$OWNER_USER
POSTGRES_PASSWORD=$OWNER_PASS
APP_DB_USER=$APP_USER
APP_DB_PASSWORD=$APP_PASS
JWT_SECRET=solo-para-pruebas-e2e
EOF
# Por si quedó algo de una corrida anterior interrumpida.
docker compose -f docker-compose.yml -f docker-compose.test.yml down -v >/dev/null 2>&1 || true

log "levantando Postgres"
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d db >/dev/null
for _ in $(seq 1 60); do
  [ "$(docker inspect --format='{{.State.Health.Status}}' raiz-db 2>/dev/null)" = "healthy" ] && break
  sleep 1
done
[ "$(docker inspect --format='{{.State.Health.Status}}' raiz-db 2>/dev/null)" = "healthy" ] || { echo "Postgres no arrancó"; exit 1; }

log "aplicando migraciones"
bash apply-migrations.sh | tail -3

log "creando rol de aplicación"
APP_DB_PASSWORD="$APP_PASS" bash create-app-role.sh | grep -E "ok|FALLO|✓|✗"

log "sembrando cuentas de prueba"
cd "$HERE"
node seed.mjs

# ── API ──────────────────────────────────────────────────────────────────
log "arrancando el API en :$API_PORT"
[ -d "$API_DIR/node_modules" ] || (cd "$API_DIR" && npm install --silent)
(
  cd "$API_DIR"
  export DATABASE_URL="postgresql://$APP_USER:$APP_PASS@127.0.0.1:$DB_PORT/$DB"
  export JWT_SECRET=solo-para-pruebas-e2e
  export PORT=$API_PORT
  # Límites holgados: la suite crea mucho contenido con pocas cuentas en
  # poco tiempo (igual que api/run-tests.sh hace con las suyas).
  export RATE_LIMIT_POSTS_PER_HOUR=100000
  export RATE_LIMIT_COMMENTS_PER_HOUR=100000
  exec node src/server.js
) > "$TMP/api.log" 2>&1 &
API_PID=$!
for _ in $(seq 1 40); do
  curl -sf "http://localhost:$API_PORT/health" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -sf "http://localhost:$API_PORT/health" >/dev/null 2>&1 || { echo "el API no respondió — ver $TMP/api.log"; cat "$TMP/api.log"; exit 1; }

# ── Web (export estático, más rápido y determinista que expo start) ──────
log "compilando la web (expo export)"
cd "$ROOT"
rm -rf "$TMP/web-dist"
# El .env real del repo trae el EXPO_PUBLIC_API_URL del túnel de Cloudflare
# (para probar en el teléfono) — Expo CLI carga ese archivo y PISA la
# variable que se pase por el entorno del shell, así que se aparta mientras
# dura el export y se restaura siempre (ver cleanup()), aunque falle algo.
if [ -f "$ROOT/.env" ]; then
  mv "$ROOT/.env" "$ROOT/.env.e2e-bak"
  ENV_MOVED=1
fi
# --clear: sin esto Metro puede servir una transformación en caché de un
# `expo start` anterior con OTRA EXPO_PUBLIC_API_URL ya incrustada.
EXPO_PUBLIC_API_URL="http://localhost:$API_PORT" npx expo export --platform web --clear --output-dir "$TMP/web-dist" >"$TMP/expo-export.log" 2>&1 \
  || { echo "expo export falló — ver $TMP/expo-export.log"; tail -60 "$TMP/expo-export.log"; exit 1; }
if [ -n "$ENV_MOVED" ]; then
  mv -f "$ROOT/.env.e2e-bak" "$ROOT/.env"
  ENV_MOVED=""
fi
grep -q "localhost:$API_PORT" "$TMP/web-dist/_expo/static/js/web/"*.js \
  || { echo "el export no incrustó EXPO_PUBLIC_API_URL=http://localhost:$API_PORT — revisar .env"; exit 1; }

log "sirviendo la web en :$WEB_PORT"
node "$HERE/serve-static.mjs" "$TMP/web-dist" "$WEB_PORT" > "$TMP/web.log" 2>&1 &
WEB_PID=$!

log "sirviendo el panel de administración en :$ADMIN_PORT"
(cd "$ADMIN_DIR" && exec node serve.mjs) > "$TMP/admin.log" 2>&1 &
ADMIN_PID=$!

for url in "http://localhost:$WEB_PORT" "http://localhost:$ADMIN_PORT"; do
  ok=0
  for _ in $(seq 1 30); do curl -sf "$url" >/dev/null 2>&1 && { ok=1; break; }; sleep 0.5; done
  [ "$ok" = 1 ] || { echo "no respondió $url"; exit 1; }
done

# ── Pruebas ────────────────────────────────────────────────────────────
log "corriendo @playwright/test"
cd "$HERE"
E2E_API_URL="http://localhost:$API_PORT" \
E2E_APP_URL="http://localhost:$WEB_PORT" \
E2E_ADMIN_URL="http://localhost:$ADMIN_PORT" \
  npx playwright test "$@"
