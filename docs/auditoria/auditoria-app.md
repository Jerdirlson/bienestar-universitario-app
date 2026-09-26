# Auditoría de producto — Raíz

Fecha: 26 de septiembre de 2026. Realizada sobre un entorno local completo (Postgres
efímero + API + web exportada de Expo + panel de administración), igual al que monta
`e2e/run.sh`, pero recorrido a mano con Playwright (Edge, viewport 390×844 y una pasada
de verificación a 360×640) en vez de correr la suite automática. Se sembraron 5 cuentas
(`ana`, `beto`, `caro`, `dani`, `admin@upb.edu.co`) con perfiles, checkins de 21 días,
entradas de diario libre, publicaciones en todos los estados (publicado, en revisión,
oculto por reportes, retenido por crisis), comentarios anidados, reacciones, reportes,
seguidos y un bloqueo real, para ver la app llena de contenido y no solo vacía. Se
tomaron 121 capturas (`docs/auditoria/capturas/`), todas revisadas visualmente.

No se modificó código ni se hizo ningún commit. El entorno (Docker, API, web, panel)
quedó completamente abajo al terminar.

## Resumen ejecutivo

Raíz es un producto notablemente pulido para su etapa: el diseño visual es cálido y
consistente, el copy está muy bien escrito en los dos idiomas, y las decisiones más
delicadas del dominio (privacidad del diario, anonimato real, retención de contenido de
riesgo, SOS siempre disponible, eliminar cuenta con confirmación explícita) están
resueltas con mucho más cuidado del que suele verse en un proyecto de este tamaño. La
arquitectura local-first funciona de verdad: Inicio y Progreso se mantienen usables con
el API completamente caído. El panel de administración cumple su función (cola de
moderación, reportes, estadísticas sin tocar el diario) aunque se ve como una
herramienta aparte del resto de la marca.

Los problemas encontrados son en su mayoría menores y puntuales, con dos excepciones que
merecen atención pronta: el logo de la UPB se renderiza roto en las dos primeras
pantallas que ve cualquier persona (splash y login), y a 360px de ancho (un Android de
gama baja común) la barra de pestañas flotante tapa el botón principal para escribir en
el diario libre. Ninguno de los hallazgos compromete las dos reglas que CLAUDE.md marca
como no negociables: el SOS respondió en todos los puntos de entrada probados, y no se
encontró ninguna fuga de contenido del diario ni de autoría anónima.

## Tabla de hallazgos

| ID | Pantalla | Tipo | Severidad | Descripción | Captura | Sugerencia |
|----|----------|------|-----------|--------------|---------|------------|
| H1 | Inicio (360×640) | Bug | **Alta** | La barra de pestañas flotante tapa el botón "ESCRIBIR" de la tarjeta "Diario libre": el texto del botón queda parcialmente cubierto por los íconos de navegación. A 390×844 no se nota; a 360×640 (ancho real de varios Android económicos) sí, y dificulta tocar el botón. | `111-360-home.png` | Agregar más `paddingBottom` al contenido de Inicio (o a toda pantalla con tab bar flotante) calculado sobre el alto real de la barra, no un valor fijo pensado para 390px. |
| H2 | Splash y Login | Visual / Bug | **Media** | El wordmark "UPB" ("Una iniciativa de UPB") se renderiza con glifos superpuestos/ilegibles — parece una fuente o un SVG mal cargado — en las dos primeras pantallas que ve cualquier usuario. | `01-splash.png`, `09-login-vacio.png` | Revisar el asset del logo UPB (si es texto con fuente custom, cargarlo como imagen/SVG en vez de tipografía; si ya es imagen, verificar que el archivo no esté corrupto o mal recortado). |
| H3 | Explorar → 5-4-3-2-1 | UX / hueco funcional | **Media** | El botón "Siguiente" está habilitado aunque no se toque ninguno de los 5 círculos ("Nombra 5 cosas que puedes ver"). Se puede completar todo el ejercicio de grounding en segundos sin interactuar con él, lo que le resta el valor terapéutico que el ejercicio busca dar en una crisis de ansiedad. | `74-grounding-paso-1.png`, `75-grounding-final.png` | Deshabilitar "Siguiente" hasta marcar al menos un círculo por paso (igual que el check-in ya deshabilita "Siguiente" en Causas hasta elegir una). |
| H4 | Inicio / Comunidad al perder el API | UX | **Media** | Con el servidor caído, Comunidad y el compositor de publicaciones muestran avisos claros ("Parece que no hay conexión..."), pero Inicio y Progreso siguen mostrando racha, calendario y gráficos con total normalidad, sin ningún indicio de que están mostrando datos locales desactualizados. | `100-error-api-caido-progreso.png`, `102-error-api-caido-reload.png` | Un indicador global discreto (banda o punto "sin conexión, mostrando lo guardado") cuando falla el último intento de sincronizar, consistente en toda la app. |
| H5 | Progreso (390×844 y 360×640) | Visual | Baja-Media | El botón flotante rojo "SOS" se superpone al final del bloque "Emociones más frecuentes / Lo que más influye", tapando parcialmente la última fila de texto. | `21-progreso-caro-1-dia.png`, `112-360-progreso.png` | Añadir margen inferior al contenido de Progreso equivalente al tamaño del botón SOS, o anclarlo con menos superposición sobre listas. |
| H6 | Progreso → detalle de un día | Accesibilidad | Baja-Media | El botón "×" para cerrar el modal de detalle del día se ve notablemente pequeño frente al resto de controles de la app (que sí manejan buen tamaño táctil). | `26-checkin-detalle-dia-pasado-ana.png` | Verificar que el área táctil real (no solo el ícono visible) llegue a 44×44dp. |
| H7 | Check-in (1/5–4/5) | Contenido | Baja | El contador de pasos muestra "1/5" a "4/5" pero solo hay 4 pantallas de contenido antes del resumen final (que no lleva número): nunca aparece "5/5". | `13`, `15`, `16`, `18` (check-in) | Cambiar el denominador a "/4", o numerar también la pantalla de resumen como el paso 5. |
| H8 | Diario libre → Escribir | UX | Baja | Al volver a "Escribir" con un borrador reciente aparece "Recuperamos tu borrador", pero si se cambia de pestaña de prompt (p. ej. de "Lo que me ayudó hoy" a "Carta para mí") el cuadro de texto se ve vacío (0/10000) sin aclarar si el borrador anterior se perdió o sigue guardado bajo el otro prompt. | `31-diario-editor-carta-para-m-.png` | Al cambiar de prompt con un borrador de otro prompt pendiente, o limpiar el aviso o mostrar explícitamente a qué prompt pertenece el borrador recuperado. |
| H9 | Diario libre → selector de prompts | Visual / UX | Baja | Los chips de prompts ("Gratitud", "Lo que me preocupa"...) se cortan en el borde derecho de la pantalla sin ninguna pista visual (flecha, degradado) de que la fila se puede deslizar horizontalmente. | `27-diario-selector-prompts.png`, `116-360-diario-editor.png` | Agregar un degradado sutil en el borde o una flecha "›" cuando hay más contenido fuera de pantalla. |
| H10 | Perfil (menú de ajustes) | Contenido | Baja | La pantalla se titula "PERFIL" y dentro de su propia lista de opciones hay una fila también llamada "Perfil" (que en realidad abre la vista pública). El nombre repetido puede confundir sobre a dónde lleva. | `52-perfil-propio.png` | Renombrar la fila a algo como "Ver mi perfil público" para diferenciarla del título de la pantalla. |
| H11 | Check-in vs. Diario libre | Visual | Baja | El selector de ánimo usa dos lenguajes visuales distintos: en el check-in son 5 círculos de colores llenos (rojo/naranja/lila/celeste/verde); en el diario libre son 5 círculos grises donde solo el elegido se colorea. Mismo concepto de "cómo te sientes", dos estilos. | `13-checkin-1-animo.png` vs. `38-diario-editar-entrada-existente.png` | Unificar el componente de selector de ánimo entre ambos módulos. |
| H12 | Diario libre → detalle de una entrada | Visual | Baja | Tras los botones "Editar"/"Borrar" queda más de media pantalla completamente en blanco; se siente incompleta frente al resto de la app. | `37-diario-detalle-entrada.png` | Aprovechar el espacio con metadatos (prompt usado, ánimo, tiempo de escritura) o simplemente permitir que la tarjeta no ocupe todo el alto. |
| H13 | Panel de administración | Visual | Baja | El panel (`/panel`) usa tarjetas planas blanco/gris sin relación visual con la paleta cálida y las formas redondeadas de la app; funciona bien pero se siente una herramienta aparte, no parte de la misma marca. | `106-admin-panel-cola-moderacion.png` | Aplicar mínimamente la paleta de marca (colores de acento, tipografía de títulos) sin rehacer la interfaz. |
| H14 | Comunidad (feed general) | UX | Baja | Una publicación propia retenida ("En revisión") aparece mezclada en el feed principal como cualquier otra, distinguible solo por una etiqueta amarilla pequeña que hay que leer con atención. | `83-idioma-community-en.png` | Considerar una sección/filtro separado para "lo mío pendiente" en vez de mezclarlo inline, o resaltar más el estado (borde de color, por ejemplo). |
| H15 | Explorar → 5-4-3-2-1 / Retos | Hueco funcional | Baja | No se encontró forma de recuperar contraseña ni de solicitar acceso desde la pantalla de login; dado que las cuentas las aprovisiona la institución esto puede ser intencional, pero no hay ningún texto que lo explique si alguien llega sin saber su contraseña. | `09-login-vacio.png` | Agregar una línea de ayuda ("¿No tienes cuenta o olvidaste tu clave? Contacta a Bienestar Universitario") aunque no haya flujo de self-service todavía. |

## Lo que funciona bien (no tocar)

- **Diseño visual coherente**: paleta cálida, ilustraciones y tipografía consistentes en
  las más de 30 pantallas recorridas; nada se siente "de plantilla genérica".
- **Privacidad por defecto real**: publicar y comentar nacen en modo "Anónimo" aunque la
  cuenta ya tenga alias — hay que elegir explícitamente publicar con nombre, en ambos
  flujos (posts y comentarios), y el mensaje lo explica ("Nadie, ni otras personas ni tu
  perfil público, podrá ligar esto contigo").
- **Transparencia sobre contenido retenido**: "Mis publicaciones" muestra con claridad
  por qué algo está "En revisión" u "Oculta" ("Varias personas la reportaron. Está oculta
  mientras un moderador la revisa"), sin dejar al usuario en la incertidumbre.
- **Resiliencia local-first**: con el API completamente caído, Inicio y Progreso siguen
  funcionando con datos guardados en el teléfono, incluso tras recargar la página en
  frío — coincide con lo que CLAUDE.md promete sobre "el diario se guarda primero en el
  teléfono".
- **SOS siempre responde**: probado desde Inicio, Comunidad, Progreso, Explorar y Normas
  de la comunidad; los cuatro recursos siempre aparecen y ninguno queda "mudo" (el que
  todavía no está activo, Consejería UPB, se muestra igual con la etiqueta "Pronto" en
  vez de desaparecer).
- **Eliminar cuenta** explica exactamente qué se borra del servidor y qué queda solo en
  el teléfono, y exige escribir "ELIMINAR" para confirmar — un patrón de confirmación
  serio para una acción irreversible.
- **Traducción es↔en completa**: se recorrieron Inicio, Explorar, Comunidad, Progreso y
  SOS en inglés sin encontrar ningún `undefined`, cadena sin traducir o mezcla de
  idiomas.
- **Comentarios anidados y reacciones en vivo**: responder a un comentario lo indenta
  correctamente bajo su padre, y los contadores de reacciones/comentarios se actualizan
  al instante sin recargar.
- **Reto de hábitos**: tarjeta de progreso con barra de días, "Hoy ya registrado" y
  "Abandonar" claros; los logros muestran progreso real ("1/7") en vez de quedarse en 0.
- **Estados vacíos cuidados**: guardados, mis publicaciones, notificaciones y bloqueados
  usan el mismo ícono de brote y un tono amable y consistente cuando no hay nada que
  mostrar.
- **Panel de administración funcionalmente completo**: cola de moderación separa crisis
  de revisión, reportes muestra motivos sin revelar quién reportó, aprobar/rechazar
  notifica al autor, y estadísticas nunca expone nada del diario privado, tal como exige
  `api/API.md`.
- **Login sin fugas de información**: contraseña incorrecta y correo fuera de dominio
  UPB devuelven exactamente el mismo mensaje, sin dar pistas de si una cuenta existe.

## Top 10 de mejoras por impacto / esfuerzo

1. **Arreglar el logo UPB roto** (H2) — altísima visibilidad (primera pantalla de la
   app), esfuerzo probablemente bajo (asset mal referenciado).
2. **Liberar el botón "ESCRIBIR" tapado en Inicio a 360px** (H1) — bloquea una acción
   principal en teléfonos de gama baja, esfuerzo bajo (ajuste de padding).
3. **Exigir interacción real en el ejercicio 5-4-3-2-1** (H3) — le devuelve valor
   terapéutico a una herramienta pensada para momentos de ansiedad, esfuerzo medio.
4. **Indicador consistente de "sin conexión"** (H4) — impacto en la confianza del
   usuario sobre si sus datos están sincronizados, esfuerzo medio (un componente
   reutilizable).
5. **Agrandar el botón "×" del detalle de día en Progreso** (H6) — accesibilidad barata
   de arreglar.
6. **Unificar el selector de ánimo entre check-in y diario libre** (H11) — pequeño pero
   se nota, mismo componente reutilizado, esfuerzo bajo.
7. **Pista visual de scroll en los chips de prompts del diario** (H9) — evita que
   alguien no descubra "Carta para mí" o "Escritura libre", esfuerzo bajo.
8. **Corregir el contador "X/5" del check-in** (H7) — cambio de copy/lógica trivial.
9. **Un mínimo de identidad visual compartida en el panel admin** (H13) — impacto
   interno (equipo de moderación), esfuerzo medio.
10. **Texto de ayuda en Login para quien no tiene clave** (H15) — barato, reduce
    fricción de soporte mientras no exista self-service de contraseña.

## Metodología (para replicar o extender)

- Entorno: mismo stack que `e2e/run.sh` (Postgres 16 en Docker, puerto 15432; API en
  `:3000`; `expo export --platform web` servido estático en `:8081`; panel en `:5173`),
  levantado a mano en pasos para poder mantenerlo vivo mientras se navegaba.
- Cuentas: las 5 fijas de `e2e/seed.mjs` (`ana`, `beto`, `caro`, `dani`,
  `admin@upb.edu.co`, contraseña `clave-e2e-fija`) más una cuenta 100% nueva para los
  estados vacíos y las cuentas efímeras que ya trae `e2e/db.mjs`.
- Contenido sembrado vía API (`api/API.md`): 14 publicaciones en varios temas y estados
  (incluidas una retenida por crisis y otra por revisión), reacciones cruzadas,
  comentarios y una respuesta anidada, 3 reportes sobre un mismo post, un seguimiento y
  un bloqueo real, 21 check-ins consecutivos para `ana` (racha real) y 10 para `beto`, y
  4 entradas de diario libre con distintos `promptKey`.
- Navegación: Playwright (`chromium.launch({ channel: 'msedge' })`) reutilizando los
  mismos selectores que ya usa la suite real (`e2e/ui.mjs`, `e2e/specs/*.spec.mjs`), en
  vez de aserciones se tomó una captura por pantalla/estado relevante.
- Capturas: 121 en total, en `docs/auditoria/capturas/`, viewport principal 390×844 y
  una pasada de verificación a 360×640 sobre las pantallas de mayor uso.
- Estado de error probado apagando el proceso del API a mitad de sesión (mismo mecanismo
  que `e2e/apiControl.mjs`) y confirmando la recuperación al reiniciarlo.
- Los scripts usados para sembrar contenido y recorrer la app se guardaron en
  `e2e/.tmp/` (carpeta ya ignorada por git) y no se commitearon ni forman parte del
  entregable.

## Cierre del entorno

Al terminar se apagaron: el navegador y sus procesos, los tres servidores Node (API,
web, panel), y `docker compose down -v` sobre `deploy/docker-compose.yml` +
`docker-compose.test.yml` (contenedor `raiz-db`, volumen `raiz_pgdata` y red `raiz_net`
eliminados). No quedó ningún contenedor ni proceso de esta auditoría corriendo. No se
tocó la VPS ni ningún `.env` de producción; `deploy/.env` se usó solo con credenciales
de prueba locales (`pruebas-locales*`) y sigue ignorado por git.
