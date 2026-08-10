# Raíz — notas para trabajar en este repo

App de bienestar mental para estudiantes de la **UPB Bucaramanga**. Expo /
React Native, bilingüe español-inglés. El proyecto pertenece a la UPB aunque el
repositorio viva en una cuenta personal.

**El repositorio es público.** Nunca commitear un `.env`, credenciales, ni datos
del servidor. La plantilla es `.env.example`.

## Arrancar

```bash
npm start        # Expo; escanear el QR con Expo Go
npm test         # 30 pruebas, segundos, sin dependencias externas
npm run db:test  # esquema y seguridad de la base en Docker
```

Detalle del flujo de desarrollo y sus trampas: skill `desarrollo-raiz`.

## Las dos reglas que no se negocian

**1. El SOS siempre funciona.** Todo botón de la pantalla de crisis hace algo, y
si falla abrir el marcador muestra el número para marcarlo a mano. Los recursos
viven en `src/data/crisisResources.js`, cada uno con su fuente oficial y fecha
de verificación en comentarios. **Ningún número entra sin verificar contra una
fuente oficial.** Seis pruebas lo protegen y bloquean el despliegue.

**2. El diario es privado.** Ninguna política de la base de datos permite que
otra persona —moderador o administrador incluido— lea entradas ajenas. Hay 12
pruebas de seguridad que lo verifican atacando la frontera, no describiéndola.
Si una falla, hay una fuga.

## Estructura

```
src/
  screens/      pantallas          components/   piezas reutilizables
  navigation/   stacks y tabs      context/      estado global (AppContext)
  data/         capa de datos      lib/          lógica pura (fechas, rachas)
  i18n.js       todos los textos   theme.js      colores y tipografías
supabase/       esquema, políticas y sus pruebas
deploy/         despliegue de Postgres autoalojado
tests/          pruebas unitarias
```

## Convenciones

**Lógica pura separada de la plataforma.** `src/data/entriesRepository.js` y
`src/lib/` no importan nada de React Native, así que corren en Node y se prueban
sin simuladores. `src/data/store.js` es el único archivo atado a AsyncStorage —
es lo que cambia el día que los datos vivan en un servidor.

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

Prototipo con persistencia local. **No está en producción y ningún estudiante
real lo ha usado.**

| | |
|---|---|
| Pantallas, navegación, bilingüe | Listo |
| SOS con líneas de crisis verificadas | Listo, sin probar en dispositivo físico |
| Check-in con persistencia local | Listo |
| Esquema de base de datos y políticas | Escrito y probado, **sin desplegar** |
| Autenticación / SSO institucional | Pendiente |
| Backend y sincronización | Pendiente — la app y la base no se hablan todavía |
| Comunidad: publicar | Pendiente |
| Contenido real de los artículos | Pendiente |

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

Ver `supabase/README.md` y `deploy/README.md`.

## Antes de subir

Las pruebas bloquean el despliegue a propósito: cada push a master publica una
actualización que llega a todos los teléfonos sin que nadie la revise. Correr
`npm test` antes de hacer push.
