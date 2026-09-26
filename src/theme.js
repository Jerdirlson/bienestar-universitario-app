// Tokens del sistema de diseño (ver docs/design-system.md, inspirado en Apple
// HIG). Dos capas conviven a propósito:
//
//  1. Tokens nuevos (`TYPE`, `COLORS` semánticos, `SPACING`, `RADIUS`,
//     `SHADOW`) — lo que usan `src/ui/*` y las pantallas rediseñadas.
//  2. Alias de compatibilidad (`COLORS.primary`, `FONTS.*`, etc.) — los
//     nombres viejos que ya usan todas las pantallas actuales, remapeados al
//     token nuevo más cercano. Así, sin tocar una sola pantalla, toda la app
//     adopta la paleta y tipografía nuevas de una vez; se van migrando
//     pantalla por pantalla a los componentes de `src/ui/` después.
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// 1. Tipografía (§2 del sistema de diseño)
// ---------------------------------------------------------------------------
// Pesos de Inter ya cargados por App.js. En Android y web, cada peso es una
// familia de fuente distinta (no existe "fontWeight" sobre una fuente
// personalizada: hay que elegir el archivo correcto). En iOS se usa la
// fuente del sistema (SF Pro) y el peso sí se resuelve con `fontWeight`, sin
// fijar `fontFamily` — eso es lo que le pide la fuente del sistema a RN.
const INTER_FAMILY = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

const WEIGHT_NUMERIC = { regular: '400', medium: '500', semibold: '600', bold: '700' };

// Une tamaño/interlineado (iguales en toda plataforma) con la fuente resuelta
// por plataforma para un peso dado.
function textStyle(fontSize, lineHeight, weight) {
  return {
    fontSize,
    lineHeight,
    ...(Platform.OS === 'ios'
      ? { fontWeight: WEIGHT_NUMERIC[weight] }
      : { fontFamily: INTER_FAMILY[weight] }),
  };
}

// Escala tipográfica de HIG (tabla del §2). `variant` en `src/ui/Text.js`
// indexa aquí.
export const TYPE = {
  largeTitle: textStyle(34, 41, 'bold'),
  title1: textStyle(28, 34, 'bold'),
  title2: textStyle(22, 28, 'bold'),
  title3: textStyle(20, 25, 'semibold'),
  headline: textStyle(17, 22, 'semibold'),
  body: textStyle(17, 22, 'regular'),
  callout: textStyle(16, 21, 'regular'),
  subhead: textStyle(15, 20, 'regular'),
  footnote: textStyle(13, 18, 'regular'),
  caption1: textStyle(12, 16, 'regular'),
  caption2: textStyle(11, 13, 'regular'),
};

// ---------------------------------------------------------------------------
// 2. Color (§3 del sistema de diseño) — modo claro únicamente por ahora.
// ---------------------------------------------------------------------------
const ACCENT = '#7A3FF0'; // lila Raíz — único color de acento

export const COLORS = {
  // -- tokens semánticos nuevos --
  bg: '#F2F2F7', // systemGroupedBackground
  bgElevated: '#FFFFFF', // secondarySystemGroupedBackground: tarjetas, filas, hojas
  bgPlain: '#FFFFFF', // pantallas de lectura/edición sin agrupar
  fill: 'rgba(120,120,128,0.12)', // campos, segmented control, chips inactivos
  label: '#000000',
  secondaryLabel: 'rgba(60,60,67,0.60)',
  tertiaryLabel: 'rgba(60,60,67,0.30)',
  separator: 'rgba(60,60,67,0.29)',
  accent: ACCENT,
  accentTint: 'rgba(122,63,240,0.12)', // acento al 12%
  destructive: '#FF3B30',
  success: '#34C759',
  sos: '#FF3B30',
  mood: ['#FF6B6B', '#FF9F43', '#A78BFA', '#4DABF7', '#34C759'],

  // -- alias de compatibilidad: nombres viejos → token nuevo más cercano --
  bgCard: '#FFFFFF', // = bgElevated
  ink: '#000000', // = label
  inkSoft: 'rgba(60,60,67,0.60)', // = secondaryLabel
  inkMuted: 'rgba(60,60,67,0.30)', // = tertiaryLabel
  hair: 'rgba(60,60,67,0.29)', // = separator
  primary: ACCENT, // = accent
  primarySoft: 'rgba(122,63,240,0.12)', // = accentTint
  primaryDeep: '#5B2ECC', // acento oscurecido: texto/ícono sobre accentTint, estado presionado
  upbRed: '#FF3B30', // = destructive/sos
  upbViolet: '#A78BFA', // tono violeta de marca UPB, ya no es color de acento

  // Fondos suaves de chips/temas/ilustraciones (nunca para texto largo — §3).
  // Se conservan tal cual: no son parte de la escala semántica de Apple, son
  // identidad propia de Raíz para categorías.
  tones: {
    rose: { bg: '#FCE4E7', ink: '#8B3A47' },
    peach: { bg: '#FCE8D2', ink: '#8C4A1E' },
    sun: { bg: '#FFE9A8', ink: '#7A5A12' },
    mint: { bg: '#CFEEDC', ink: '#265B3E' },
    sky: { bg: '#D6E8F5', ink: '#2C4F74' },
    lilac: { bg: '#E6DEFA', ink: '#3B2B7A' },
    blush: { bg: '#F7D4E2', ink: '#7A2D54' },
    sage: { bg: '#DAE6C9', ink: '#3E5324' },
  },
};

// ---------------------------------------------------------------------------
// 3. Espaciado, forma y elevación (§4)
// ---------------------------------------------------------------------------
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

// `pill` (999) se conserva para botones/chips totalmente redondeados que ya
// existían antes del sistema nuevo; no está en la tabla del §4 pero ninguna
// pantalla actual puede perderlo sin tocarla.
export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

// Elevación "casi plana": una sombra muy leve, solo para lo que de verdad
// flota sobre el contenido (el FAB de SOS). Las tarjetas sobre `bg` se
// distinguen por el color (bgElevated vs bg), no por sombra.
export const SHADOW = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius: 3,
  elevation: 1,
};

// Sombra un poco más marcada, solo para elementos flotantes de verdad (FAB
// de SOS, hojas). No usar en tarjetas o filas normales.
export const SHADOW_FLOATING = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 12,
  elevation: 6,
};

// ---------------------------------------------------------------------------
// 4. Alias de compatibilidad de tipografía
// ---------------------------------------------------------------------------
// Las pantallas actuales fijan `fontFamily: FONTS.xxx` directamente (nunca
// `fontWeight` aparte), así que el valor tiene que ser, él solo, una familia
// de fuente que ya se vea en negrita/semibold/etc. En iOS no hay forma de
// pedir "el peso bold de la fuente del sistema" con una sola propiedad
// `fontFamily` (RN necesita `fontWeight` aparte, y Apple no deja referenciar
// San Francisco por nombre de PostScript desde iOS 9). Por eso este alias
// usa Inter — ya cargada, y la fuente que el propio sistema de diseño nombra
// como "la más cercana a SF" — en las tres plataformas, en vez de intentar
// (y no lograr) el truco de "system bold" solo en iOS. El componente nuevo
// `src/ui/Text.js` sí hace la resolución correcta por plataforma vía `TYPE`.
export const FONTS = {
  black: 'Inter_900Black', // antes Nunito_900Black
  extraBold: 'Inter_800ExtraBold', // antes Nunito_800ExtraBold
  bold: 'Inter_700Bold', // antes Nunito_700Bold
  semiBold: 'Inter_600SemiBold', // antes Nunito_600SemiBold
  regular: 'Inter_400Regular', // antes Nunito_400Regular
  uiBold: 'Inter_700Bold',
  uiSemiBold: 'Inter_600SemiBold',
  uiMedium: 'Inter_500Medium',
  uiRegular: 'Inter_400Regular',
};
