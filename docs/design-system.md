# Raíz — sistema de diseño (inspirado en Apple HIG)

Objetivo: que Raíz se sienta como una app de Apple — calmada, clara, consistente,
nativa — sin perder su identidad (el lila de Raíz como único color de acento).
Referencia: Apple Human Interface Guidelines (tipografía, color, layout, listas,
barras, hojas, movimiento, accesibilidad).

Todo lo de aquí vive en código en `src/theme.js` (tokens) y `src/ui/`
(componentes base). Ninguna pantalla define tamaños de letra, colores o radios
sueltos: usa tokens y componentes.

## 1. Principios
1. **Claridad**: una idea principal por pantalla; jerarquía por tamaño y peso,
   no por colores.
2. **Deferencia**: el contenido manda; el cromo (barras, bordes, sombras) se
   retira. Nada de sombras pesadas ni degradados decorativos en la UI (sí en
   ilustraciones puntuales).
3. **Profundidad y movimiento con sentido**: transiciones NATIVAS del sistema,
   hojas que suben desde abajo para tareas modales, animaciones cortas con
   resorte; respetar "reducir movimiento".
4. **Consistencia**: los mismos componentes en todas partes.
5. **Tranquilidad**: es una app de salud mental. Espacio generoso, pocos
   elementos por pantalla, textos cálidos.

## 2. Tipografía
- iOS: fuente del sistema (SF Pro). Android y web: Inter (ya cargada), la más
  cercana a SF. Nunito se retira de la UI (solo queda en la marca/logotipo si
  hace falta).
- Escala (tamaño/interlineado, peso), igual a la de HIG:

| Token | Tamaño/interlineado | Peso | Uso |
|---|---|---|---|
| `largeTitle` | 34/41 | bold | Título grande de pestañas raíz |
| `title1` | 28/34 | bold | Encabezados de pantalla sin barra grande |
| `title2` | 22/28 | bold | Secciones importantes |
| `title3` | 20/25 | semibold | Títulos de tarjeta |
| `headline` | 17/22 | semibold | Filas destacadas, botones |
| `body` | 17/22 | regular | Texto principal |
| `callout` | 16/21 | regular | Texto secundario destacado |
| `subhead` | 15/20 | regular | Metadatos, subtítulos |
| `footnote` | 13/18 | regular | Encabezados/pies de sección (MAYÚSCULAS no; oración normal) |
| `caption1` | 12/16 | regular | Etiquetas pequeñas |
| `caption2` | 11/13 | regular | Mínimo absoluto |

- Soporta tamaño de texto dinámico: no fijar `allowFontScaling={false}`; los
  contenedores deben crecer con el texto.
- En Android con fuentes personalizadas, cada peso es una familia distinta
  (`Inter_600SemiBold`, etc.); nunca usar `fontWeight` con una familia
  personalizada. `src/theme.js` resuelve esto por plataforma.

## 3. Color (tokens semánticos, modo claro)
| Token | Valor | Uso |
|---|---|---|
| `bg` (systemGroupedBackground) | `#F2F2F7` | Fondo de pantallas con listas/tarjetas |
| `bgElevated` (secondarySystemGrouped) | `#FFFFFF` | Tarjetas, filas agrupadas, hojas |
| `bgPlain` | `#FFFFFF` | Pantallas de lectura/edición sin agrupar |
| `fill` | `rgba(120,120,128,0.12)` | Campos de texto, controles segmentados, chips inactivos |
| `label` | `#000000` | Texto principal |
| `secondaryLabel` | `rgba(60,60,67,0.60)` | Texto secundario |
| `tertiaryLabel` | `rgba(60,60,67,0.30)` | Marcadores de posición, deshabilitado |
| `separator` | `rgba(60,60,67,0.29)` a 1 px físico (`StyleSheet.hairlineWidth`) | Divisores |
| `accent` | `#7A3FF0` (lila Raíz) | Único color de acento: botones, enlaces, selección, tab activa |
| `accentTint` | acento al 12% | Fondos de botones tintados/chips activos |
| `destructive` | `#FF3B30` | Borrar, cerrar sesión, eliminar cuenta |
| `success` | `#34C759` | Confirmaciones |
| `sos` | `#FF3B30` | Botón SOS (siempre reconocible) |
| `mood[0..4]` | `#FF6B6B, #FF9F43, #A78BFA, #4DABF7, #34C759` | Solo para ánimo |

- El resto de colores (tonos de temas/categorías) se usan solo como fondos
  suaves de chips/ilustraciones, nunca para texto largo.
- Contraste mínimo AA (4.5:1 texto normal). Nada de texto gris claro sobre
  lila claro.
- Tokens preparados para un modo oscuro futuro (no se implementa ahora).

## 4. Espaciado, forma y elevación
- Rejilla de 4 pt: `xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, xxxl 32`.
- Márgenes laterales de pantalla: 16 (20 en pantallas de lectura).
- Radios: `sm 8` (chips pequeños), `md 12` (botones, campos), `lg 16` (tarjetas),
  `xl 20` (hojas y tarjetas grandes). En iOS usar `borderCurve: 'continuous'`
  (esquinas "squircle" de Apple).
- Elevación: casi plana. Tarjetas sobre `bg` gris se distinguen por el color,
  sin sombra; una sombra muy leve solo en elementos flotantes (FAB SOS).
- Objetivo táctil mínimo 44×44.

## 5. Componentes base (`src/ui/`)
- `Screen`: contenedor con fondo, áreas seguras y manejo de teclado incluido
  (ver §8). Variantes `grouped` (fondo gris) y `plain` (blanco).
- `LargeTitle` / encabezado: en pestañas raíz, título grande a la izquierda que
  se integra con la barra de navegación nativa (native-stack `headerLargeTitle`
  en iOS); en detalle, barra estándar con título centrado y "atrás" nativo.
- `Button`: variantes `filled` (acento, texto blanco), `tinted` (fondo acento
  12%, texto acento), `plain` (solo texto acento), `destructive`. Alto 50 (48 en
  Android), radio 12, texto `headline`. Estados: presionado (opacidad 0.7),
  deshabilitado, cargando.
- `ListSection` + `ListRow` (lista agrupada inset estilo Ajustes): encabezado
  `footnote` en `secondaryLabel`, filas blancas con radio 12 en el grupo,
  separadores de 1 px con sangría, icono opcional en cuadrado de color, texto
  `body`, valor secundario a la derecha y chevron. Para Perfil, ajustes,
  notificaciones, bloqueados, normas, etc.
- `Card`: fondo `bgElevated`, radio 16, padding 16, sin sombra.
- `SegmentedControl`: estilo iOS (fondo `fill`, píldora blanca deslizante) para
  pestañas internas (Para ti/Siguiendo, Semana/Mes).
- `SearchField`: campo gris `fill` con icono de lupa, radio 10, alto 36.
- `TextField` / `TextArea`: fondo `bgElevated` o `fill`, radio 12, `body`.
- `Chip`: radio 16, `subhead`, inactivo `fill`, activo `accentTint` + texto acento.
- `Sheet`: hojas nativas (`presentation: 'formSheet'` con detents en native-stack
  cuando sea una pantalla; para menús cortos, hoja propia con asa superior).
- `Avatar`, `EmptyState` (icono grande en gris, título `title3`, texto
  `subhead`, acción opcional), `Toast`.
- Iconos: `Ionicons` de `@expo/vector-icons` (estilo iOS), variantes `-outline`
  por defecto y rellenas para la pestaña activa. Tamaño 22–24 en barras.
- Háptica (`expo-haptics`): selección al elegir ánimo/chips, impacto leve al
  reaccionar, éxito al guardar un check-in. Nunca en scroll.

## 6. Navegación y transiciones
- `@react-navigation/native-stack` en todos los stacks: transiciones nativas
  del sistema (push lateral en iOS con gesto de volver desde el borde; la de
  Android en Android). Esto reemplaza las animaciones JS que causaban saltos y
  parpadeo.
- Modales (Publicar, SOS, reportar): `presentation: 'modal'` o `'formSheet'`
  nativos.
- Barra de pestañas estándar (no flotante): 4 pestañas con icono + etiqueta,
  fondo translúcido con desenfoque en iOS (`expo-blur`), borde superior de 1 px.
  Se oculta en pantallas de detalle empujándolas por encima de las pestañas
  (no apareciendo/desapareciendo a mano).
- Nada de animaciones de entrada propias que compitan con la transición nativa.

## 7. Movimiento
- Duraciones cortas (200–300 ms), curvas con resorte suave; `Animated` con
  `useNativeDriver: true` siempre que se pueda.
- Respetar `AccessibilityInfo.isReduceMotionEnabled()`: sin animaciones
  decorativas si está activo.

## 8. Teclado (regla dura)
- Toda pantalla con campos usa `Screen` con manejo de teclado: el campo
  enfocado y su acción principal quedan SIEMPRE visibles sobre el teclado, en
  iOS y Android (edge-to-edge obligatorio desde SDK 55).
- Formularios largos dentro de `ScrollView` con
  `keyboardShouldPersistTaps="handled"` y desplazamiento automático al campo.
- Barras de acción inferiores (enviar comentario, publicar) se anclan encima
  del teclado.
- Se verifica en el emulador de Android con capturas reales, no solo en web.

## 9. Accesibilidad
- `accessibilityLabel`/`Role` en todo lo tocable; orden de lectura lógico.
- Contraste AA; tamaño dinámico; objetivos de 44 pt; nada que dependa solo del
  color (el ánimo lleva cara y texto).

## 10. Contenido y tono
- Español estándar, cálido, breve. Títulos en oración ("Tu diario"), no en
  MAYÚSCULAS. Botones con verbo ("Guardar", "Publicar").
