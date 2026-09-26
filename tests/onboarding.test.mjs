// Lógica pura del onboarding nuevo (src/lib/onboarding.js): pasos, enfoque
// de personalización y a dónde navega Splash. La pantalla en sí (Animated,
// AsyncStorage) se prueba con la suite e2e, no aquí.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TOTAL_STEPS, FOCUS_OPTIONS,
  clampStep, isLastStep, progressFor, toggleFocus,
  hasOnboarded, parseFocus, serializeFocus, decideSplashRoute,
} from '../src/lib/onboarding.js';

test('clampStep mantiene el paso dentro de [0, total-1]', () => {
  assert.equal(clampStep(-3), 0);
  assert.equal(clampStep(0), 0);
  assert.equal(clampStep(2), 2);
  assert.equal(clampStep(999), TOTAL_STEPS - 1);
  assert.equal(clampStep(NaN), 0);
  assert.equal(clampStep(undefined), 0);
});

test('isLastStep solo es cierto en el último paso', () => {
  for (let i = 0; i < TOTAL_STEPS - 1; i++) assert.equal(isLastStep(i), false);
  assert.equal(isLastStep(TOTAL_STEPS - 1), true);
  assert.equal(isLastStep(999), true); // se clampea antes de comparar
});

test('progressFor avanza de forma monótona y el primer paso no arranca en 0', () => {
  const values = Array.from({ length: TOTAL_STEPS }, (_, i) => progressFor(i));
  assert.ok(values[0] > 0, 'el primer paso ya muestra algo de avance');
  assert.equal(values[TOTAL_STEPS - 1], 1);
  for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1]);
});

test('toggleFocus agrega y quita manteniendo el orden de FOCUS_OPTIONS', () => {
  let sel = toggleFocus([], 'relations');
  assert.deepEqual(sel, ['relations']);
  sel = toggleFocus(sel, 'live_well');
  // 'live_well' va antes que 'relations' en FOCUS_OPTIONS, aunque se tocó después.
  assert.deepEqual(sel, ['live_well', 'relations']);
  sel = toggleFocus(sel, 'live_well');
  assert.deepEqual(sel, ['relations']);
});

test('toggleFocus ignora duplicados al togglear dos veces seguidas', () => {
  const once = toggleFocus([], 'mindfulness');
  const twice = toggleFocus(once, 'mindfulness');
  assert.deepEqual(twice, []);
});

test('hasOnboarded distingue string guardado de nada guardado', () => {
  assert.equal(hasOnboarded(null), false);
  assert.equal(hasOnboarded(undefined), false);
  assert.equal(hasOnboarded(''), false);
  assert.equal(hasOnboarded('1'), true);
});

test('serializeFocus/parseFocus hacen ida y vuelta y descartan claves desconocidas', () => {
  const raw = serializeFocus(['relieve_stress', 'live_well']);
  assert.deepEqual(parseFocus(raw), ['relieve_stress', 'live_well']);
  assert.deepEqual(parseFocus('no es json'), []);
  assert.deepEqual(parseFocus(null), []);
  assert.deepEqual(parseFocus(JSON.stringify(['live_well', 'algo_inventado'])), ['live_well']);
});

test('FOCUS_OPTIONS coincide con las categorías que ya existen en Explorar', () => {
  // Si esto cambia sin querer, la personalización deja de resaltar nada en
  // ExploreScreen.js (CATEGORY_ORDER) porque las claves ya no coinciden.
  assert.deepEqual(FOCUS_OPTIONS, ['live_well', 'relieve_stress', 'relations', 'mindfulness']);
});

// ── a dónde navega Splash ────────────────────────────────────────────────────

test('decideSplashRoute: con sesión va directo a Main, sin importar el onboarding', () => {
  assert.deepEqual(
    decideSplashRoute({ sessionToken: 'tok', sessionExpired: false, onboardingDone: false }),
    { name: 'Main' }
  );
});

test('decideSplashRoute: sesión vencida va a Login con el aviso', () => {
  assert.deepEqual(
    decideSplashRoute({ sessionToken: null, sessionExpired: true, onboardingDone: true }),
    { name: 'Login', params: { expired: true } }
  );
});

test('decideSplashRoute: sin sesión y onboarding ya visto va a Login sin repetirlo', () => {
  assert.deepEqual(
    decideSplashRoute({ sessionToken: null, sessionExpired: false, onboardingDone: true }),
    { name: 'Login' }
  );
});

test('decideSplashRoute: sin sesión y nunca visto muestra el onboarding', () => {
  assert.deepEqual(
    decideSplashRoute({ sessionToken: null, sessionExpired: false, onboardingDone: false }),
    { name: 'Onboarding' }
  );
});
