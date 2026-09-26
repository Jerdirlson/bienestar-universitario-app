# Raíz — notas para trabajar en este repo

App de bienestar mental para estudiantes de la **UPB Bucaramanga**. Expo /
React Native, bilingüe español-inglés, con backend propio en `api/` (Express +
Postgres con RLS; contrato en `api/API.md`) y panel de administración web en
`admin-web/`. El proyecto pertenece a la UPB aunque el repositorio viva en una
cuenta personal.

**El repositorio es público.** Nunca commitear un `.env`, credenciales, ni datos
del servidor. La plantilla es `.env.example`.

## Arrancar

```bash
npm start                  # Expo; escanear el QR con Expo Go
npx expo start --web       # versión web; se usa para probar de punta a punta
npm test                   # 165 pruebas, segundos, sin dependencias externas
bash api/run-tests.sh      # 141 pruebas del API contra Postgres, requiere Docker
bash supabase/run-tests.sh # políticas de seguridad (RLS), 3 archivos, requiere Docker
npm run e2e                # suite e2e (Playwright): levanta Postgres+API+web+admin-web, prueba y baja todo
```

Detalle del flujo de desarrollo y sus trampas: skill `desarrollo-raiz`.

## Las dos reglas que no se negocian

**1. El SOS siempre funciona.** Todo botón de la pantalla de crisis hace algo, y
si falla abrir el marcador muestra el número para marcarlo a mano. Los recursos
viven en `src/data/crisisResources.js`, cada uno con su fuente oficial y fecha
de verificación en comentarios. **Ningún número entra sin verificar contra una
fuente oficial.** Seis pruebas lo protegen y bloquean el despliegue.

**2. El diario es privado.** Check-in y diario libre se guardan primero en el
teléfono y se sincronizan con la cuenta, pero ninguna política de la base de
datos permite que otra persona —moderador o administrador incluido— lea
entradas ajenas. La detección de señales de crisis corre en el teléfono
(`src/lib/crisisSignals.js`); el texto no se envía a ningún lado para eso.
`supabase/tests/` lo verifica atacando la frontera, no describiéndola. Si una
falla, hay una fuga.

## Estructura

```
src/
  screens/      pantallas          components/   piezas reutilizables
  navigation/   stacks y tabs      routes/       rutas por módulo (diary, social, wellness)
  context/      AppContext y SocialContext        data/  capa de datos
  lib/          lógica pura (fechas, rachas, señales de crisis)
  i18n.js       agrega i18n/{diary,social,wellness}.js   theme.js  colores y tipografías
api/            backend v2 — Express + Postgres, contrato en api/API.md
admin-web/      panel de administración web
supabase/       esquema, políticas y sus pruebas
deploy/         despliegue de Postgres autoalojado
tests/          pruebas unitarias
```

## Convenciones

**Lógica pura separada de la plataforma.** `src/data/entriesRepository.js` y
`src/lib/` no importan nada de React Native, así que corren en Node y se prueban
sin simuladores. `src/data/store.js` es el único archivo atado a AsyncStorage:
guarda primero en el teléfono, y `src/data/diarySync.js` sincroniza con la
cuenta contra `api/` cuando hay conexión.

**Emociones y causas se guardan por clave, no por etiqueta.** `feelingItems` y
`causeItems` en `i18n.js` tienen `k` (lo que se guarda) y `label` (lo que se
muestra). Ambos idiomas comparten claves, así el texto se puede reescribir o
traducir sin tocar el histórico. Nunca guardar la etiqueta.

**Las validaciones del cliente reflejan las de la base.** `src/data/entry.js`
valida exactamente lo que restringe la tabla `entries`. Si se cambia una, se
cambia la otra — si no, lo que hoy se guarda en el teléfono será rechazado por
Postgres mañana.

**Todo texto visible pasa por `i18n.js`**, en español e inglés. Nada de cadenas
sueltas en las pantallas.

**Español estándar.** El copy usó lenguaje inclusivo con -e y se retiró
deliberadamente en agosto de 2026. No reintroducirlo.

## Estado

Sin producción ni estudiantes reales. Backend v2 completo pero **sin
desplegar en la VPS**; SSO institucional pendiente; SOS y el resto de la app
sin probar en un teléfono físico (sí en la versión web, con Playwright y con
las pruebas automáticas).

| | |
|---|---|
| Pantallas, navegación, bilingüe | Listo |
| SOS con líneas de crisis verificadas | Listo, sin probar en dispositivo físico |
| Diario: check-in y diario libre, local-first y sincronizado | Listo |
| Comunidad: feed, temas, reacciones, comentarios, perfiles, seguir, bloqueos | Listo |
| Bienestar: retos, respiración guiada, 5-4-3-2-1, artículos con fuentes | Listo |
| Moderación automática (`api/src/moderation.js`) | Listo |
| Backend v2 (`api/`) y esquema con RLS | Escrito y probado, **sin desplegar en la VPS** |
| Panel de administración (`admin-web/`) | Listo |
| Autenticación / SSO institucional | Pendiente |

## Base de datos

Postgres autoalojado (no Supabase: el servidor de destino comparte máquina con
otro proyecto y tiene 3.8 GB). El esquema es el mismo para ambos —
`deploy/migrations/` crea el `auth.users` y `auth.uid()` que Supabase daría
hecho.

**Dos roles, y la diferencia importa:** `raiz_admin` es dueño de las tablas y
por eso Postgres **no** le aplica las políticas de seguridad; es solo para
migraciones. La app se conecta con `raiz_app`, que no es dueño de nada y debe
hacer `set role authenticated` en cada transacción.

Al fijar la identidad, `set_config('request.jwt.claims', ..., true)` — **ese
`true` final es obligatorio**. Sin él el valor persiste en la conexión y, con un
pool, la siguiente petición hereda la identidad de la anterior.

Ver `supabase/README.md` y `deploy/README.md` — las migraciones llevan
registro (`deploy/apply-migrations.sh`, con `--baseline` una sola vez en una
base ya existente).

## Antes de subir

Las pruebas bloquean el despliegue a propósito: cada push a master corre
`npm test` y publica una actualización OTA a todos los teléfonos, sin que
nadie la revise, si existen el secreto `EXPO_TOKEN` y la variable de
repositorio `EXPO_PUBLIC_API_URL` (si falta alguno, las pruebas corren igual
y la publicación se omite). Correr `npm test` antes de hacer push.

Desde el salto a SDK 57, esa publicación sale dos veces (mismo código, mismo
mensaje): al branch `production` (runtime `1.1.0`, lo que leen los binarios
nativos — el APK de prueba instalado quedó fijo en runtime `1.0.0` y por
diseño no recibe estas actualizaciones nuevas) y al branch `expo-go` (runtime
`exposdk:57.0.0`, lo único que Expo Go acepta). Ver `app.config.js` y
`.github/workflows/deploy.yml`.
