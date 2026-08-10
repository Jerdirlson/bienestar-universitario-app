# Raíz

App de bienestar mental para estudiantes de la **Universidad Pontificia Bolivariana,
seccional Bucaramanga**. React Native con Expo, bilingüe español/inglés.

Registro diario de ánimo, diario personal, contenido de autocuidado, comunidad
anónima y acceso rápido a líneas de crisis.

## Titularidad

**El proyecto pertenece a la UPB.** Este repositorio vive en una cuenta personal
por conveniencia de desarrollo; la propiedad del código, la marca y los datos es
de la universidad, y el repositorio debería transferirse a una organización
institucional cuando exista.

Mantener el repositorio **privado**: aunque el código en sí no es secreto, es un
proyecto institucional en curso sobre salud mental y no conviene que se lea como
un servicio ya disponible.

## Estado

Funciona como prototipo con persistencia local. **No está en producción y no ha
sido usado por estudiantes reales.**

| | Estado |
|---|---|
| 12 pantallas, navegación, bilingüe | Listo |
| Pantalla SOS con líneas de crisis verificadas | Listo, sin probar en dispositivo físico |
| Check-in diario con persistencia | Listo, solo en el teléfono |
| Racha y calendario sobre datos reales | Listo |
| Esquema de base de datos + políticas de seguridad | Escrito y probado, sin aplicar |
| Autenticación / SSO institucional | Pendiente |
| Sincronización con servidor | Pendiente |
| Publicar en comunidad | Pendiente |
| Contenido real de los artículos | Pendiente |

El plan completo de lo que falta —capas de infraestructura, costos y trámites
institucionales pendientes— vive en el documento de infraestructura que mantiene
el equipo, fuera de este repositorio.

## Arrancar

```bash
npm install
npm start          # abre Expo; escanear el QR con Expo Go
```

```bash
npm test           # 24 pruebas de lógica y almacenamiento (Node, sin dependencias)
npm run db:test    # aplica el esquema a un Postgres efímero y prueba la seguridad (requiere Docker)
```

## Estructura

```
src/
  screens/      pantallas
  components/   piezas reutilizables
  navigation/   stacks y tabs
  context/      estado global (AppContext)
  data/         capa de datos — repositorio, validación, almacenamiento
  lib/          lógica pura: fechas y rachas
  i18n.js       todos los textos, es/en
  theme.js      colores, tipografías, radios
supabase/       esquema de base de datos, políticas y sus pruebas
tests/          pruebas unitarias
```

La capa de datos está separada a propósito: `src/data/entriesRepository.js` no
importa nada de React Native, así que corre en Node y se prueba sin simuladores.
`src/data/store.js` es el único archivo atado a AsyncStorage — es lo que cambia
el día que los datos pasen a vivir en un servidor.

## Dos reglas que no se negocian

**El flujo de crisis siempre funciona.** Los recursos de `src/data/crisisResources.js`
tienen su fuente oficial y fecha de verificación en comentarios. Todo botón de
esa pantalla hace algo, y si falla abrir el marcador muestra el número para
marcarlo a mano. Un botón muerto ahí es el peor fallo posible de esta app.

**El diario es privado.** Ninguna política de la base de datos permite que otra
persona —moderador o administrador incluido— lea las entradas de alguien más.
Ver `supabase/README.md`.

## Contribuir

Antes de cualquier cambio que toque datos de personas, correr las dos suites.
Las pruebas de `supabase/tests/` no describen la seguridad: la atacan. Si una
falla, hay una fuga.

Nunca commitear un `.env`. La plantilla es `.env.example`.
