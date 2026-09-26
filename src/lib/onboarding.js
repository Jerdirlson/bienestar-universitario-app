/**
 * Lógica pura del onboarding: nada de React Native ni AsyncStorage aquí (se
 * prueba en Node, ver tests/onboarding.test.mjs). La pantalla
 * (src/screens/OnboardingScreen.js) y el arranque (src/screens/SplashScreen.js)
 * solo llaman a estas funciones y guardan/leen el resultado.
 */

// Un paso por pilar de la app + bienvenida + enfoque. Si se agrega un paso,
// solo hay que tocar este número y los arreglos de contenido en la pantalla —
// los controles (barra de progreso, Atrás/Siguiente) se ajustan solos.
export const TOTAL_STEPS = 6;

// Las 4 categorías ya existen en Explorar (ExploreScreen.js, CATEGORY_ORDER):
// se reutilizan como opciones de "qué te gustaría trabajar" para que la
// personalización sirva para algo concreto (resaltar esas secciones) en vez
// de guardarse y no usarse en ningún lado.
export const FOCUS_OPTIONS = ['live_well', 'relieve_stress', 'relations', 'mindfulness'];

export function clampStep(step, total = TOTAL_STEPS) {
  if (!Number.isFinite(step)) return 0;
  return Math.min(Math.max(0, Math.trunc(step)), total - 1);
}

export function isLastStep(step, total = TOTAL_STEPS) {
  return clampStep(step, total) === total - 1;
}

// Progreso de 0 a 1 para animar la barra: el primer paso ya muestra algo de
// avance (1/total) en vez de arrancar en 0, para que no se sienta vacía.
export function progressFor(step, total = TOTAL_STEPS) {
  return (clampStep(step, total) + 1) / total;
}

/**
 * Agrega o quita una opción de enfoque manteniendo el orden de FOCUS_OPTIONS
 * (no el de toque), así la vista previa y ExploreScreen no dependen de en qué
 * orden se tocaron las opciones.
 */
export function toggleFocus(selected, key) {
  const set = new Set(selected ?? []);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return FOCUS_OPTIONS.filter((k) => set.has(k));
}

// Valor guardado en AsyncStorage cuando se completa u omite el onboarding.
// Cualquier valor no vacío cuenta como "ya lo vio" — así una versión vieja
// del valor (por si cambia el formato) no lo hace repetir el flujo.
export const ONBOARDED_VALUE = '1';
export function hasOnboarded(rawValue) {
  return typeof rawValue === 'string' && rawValue.length > 0;
}

// JSON guardado en AsyncStorage con las opciones de enfoque elegidas.
export function parseFocus(rawValue) {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k) => FOCUS_OPTIONS.includes(k));
  } catch {
    return [];
  }
}
export function serializeFocus(selected) {
  return JSON.stringify((selected ?? []).filter((k) => FOCUS_OPTIONS.includes(k)));
}

/**
 * A dónde navega SplashScreen al terminar de leer el almacenamiento. Antes
 * siempre iba a Onboarding si no había sesión; ahora solo si nunca se
 * completó (o saltó) antes — quien ya lo vio va directo a Login.
 */
export function decideSplashRoute({ sessionToken, sessionExpired, onboardingDone }) {
  if (sessionToken) return { name: 'Main' };
  if (sessionExpired) return { name: 'Login', params: { expired: true } };
  if (onboardingDone) return { name: 'Login' };
  return { name: 'Onboarding' };
}
