# Raíz

App de bienestar mental para estudiantes de la **Universidad Pontificia Bolivariana,
seccional Bucaramanga**. React Native con Expo, bilingüe español/inglés, con
backend propio (`api/`, Express + Postgres con RLS) y panel de administración
web (`admin-web/`).

Check-in diario y diario libre (local-first, sincronizado con la cuenta),
comunidad anónima por defecto tipo red social, contenido de bienestar con
retos y ejercicios guiados, y acceso rápido a líneas de crisis.

## Titularidad

**El proyecto pertenece a la UPB.** Este repositorio vive en una cuenta personal
por conveniencia de desarrollo; la propiedad del código, la marca y los datos es
de la universidad, y el repositorio debería transferirse a una organización
institucional cuando exista.

Mantener el repositorio **privado**: aunque el código en sí no es secreto, es un
proyecto institucional en curso sobre salud mental y no conviene que se lea como
un servicio ya disponible. Hoy, sin embargo, el repositorio es **público** (ver
`CLAUDE.md`); pasarlo a privado sigue pendiente.

## Estado

Sin producción ni estudiantes reales. Backend v2 completo pero **sin
desplegar en la VPS**; SSO institucional pendiente; SOS y el resto de la app
sin probar en un teléfono físico (sí en la versión web, con Playwright y con
las pruebas automáticas).

| | Estado |
|---|---|
| Pantallas, navegación, bilingüe | Listo |
| Pantalla SOS con líneas de crisis verificadas | Listo, sin probar en dispositivo físico |
| Diario: check-in y diario libre, local-first y sincronizado | Listo |
| Racha y calendario sobre datos reales | Listo |
| Comunidad: feed, temas, reacciones, comentarios, perfiles, seguir, bloqueos | Listo |
| Bienestar: retos, respiración guiada, 5-4-3-2-1, artículos con fuentes | Listo |
| Backend v2 (`api/`) y esquema con políticas de seguridad | Escrito y probado, **sin desplegar en la VPS** |
| Panel de administración (`admin-web/`) | Listo |
| Autenticación / SSO institucional | Pendiente |

El plan completo de lo que falta —capas de infraestructura, costos y trámites
institucionales pendientes— vive en el documento de infraestructura que mantiene
el equipo, fuera de este repositorio.

## Arrancar

```bash
npm install
npm start               # abre Expo; escanear el QR con Expo Go
npx expo start --web    # versión web; se usa para pruebas de punta a punta
```

```bash
npm test                    # 165 pruebas de lógica y almacenamiento (Node, sin dependencias)
bash api/run-tests.sh       # 141 pruebas del API contra Postgres (requiere Docker)
bash supabase/run-tests.sh  # políticas de seguridad (RLS), 3 archivos (requiere Docker)
```

## Estructura

```
src/
  screens/      pantallas
  components/   piezas reutilizables
  navigation/   stacks y tabs, con rutas por módulo en navigation/routes/
  context/      estado global — AppContext y SocialContext
  data/         capa de datos — repositorio, validación, almacenamiento y sincronización
  lib/          lógica pura: fechas, rachas, señales de crisis
  i18n.js       agrega los textos por módulo de i18n/{diary,social,wellness}.js
  theme.js      colores, tipografías, radios
api/            backend v2 — Express + Postgres con RLS; contrato en api/API.md
admin-web/      panel de administración web
supabase/       esquema de base de datos, políticas y sus pruebas
deploy/         despliegue de Postgres autoalojado
tests/          pruebas unitarias
```

La capa de datos está separada a propósito: `src/data/entriesRepository.js` no
importa nada de React Native, así que corre en Node y se prueba sin simuladores.
`src/data/store.js` es el único archivo atado a AsyncStorage: guarda primero en
el teléfono, y `src/data/diarySync.js` sincroniza con la cuenta contra `api/`
cuando hay conexión.

## Dos reglas que no se negocian

**El flujo de crisis siempre funciona.** Los recursos de `src/data/crisisResources.js`
tienen su fuente oficial y fecha de verificación en comentarios. Todo botón de
esa pantalla hace algo, y si falla abrir el marcador muestra el número para
marcarlo a mano. Un botón muerto ahí es el peor fallo posible de esta app.

**El diario es privado.** Check-in y diario libre se guardan primero en el
teléfono y se sincronizan con la cuenta, pero ninguna política de la base de
datos permite que otra persona —moderador o administrador incluido— lea las
entradas de alguien más. La detección de señales de crisis corre en el
teléfono: el texto no se envía a ningún lado para eso. Ver `supabase/README.md`.

## Contribuir

Antes de cualquier cambio que toque datos de personas, correr las suites:
`npm test`, `bash api/run-tests.sh` y `bash supabase/run-tests.sh`. Las de
`supabase/tests/` no describen la seguridad: la atacan. Si una falla, hay una
fuga.

Nunca commitear un `.env`. La plantilla es `.env.example`.
