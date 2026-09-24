// El check-in vuelve a donde empezó: abierto desde el calendario de Progreso,
// al terminar o cerrarlo vuelve a Progreso, no a Inicio.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { exitCheckin, withReturn } from '../src/lib/checkinFlow.js';

function fakeNavigation() {
  const calls = [];
  return { calls, popToTop: () => calls.push(['popToTop']), navigate: (...a) => calls.push(['navigate', ...a]) };
}

test('abierto desde Progreso: al salir vacía la pila de Inicio y vuelve a Progreso', () => {
  const nav = fakeNavigation();
  exitCheckin(nav, 'insights');
  assert.deepEqual(nav.calls, [['popToTop'], ['navigate', 'insights']]);
});

test('abierto desde Inicio: se queda en Inicio, como antes', () => {
  const nav = fakeNavigation();
  exitCheckin(nav, undefined);
  assert.deepEqual(nav.calls, [['popToTop']]);
});

test('cada paso pasa a dónde volver al siguiente, y solo a pestañas conocidas', () => {
  assert.deepEqual(withReturn({ mood: 2 }, 'insights'), { mood: 2, returnTo: 'insights' });
  assert.deepEqual(withReturn({}, undefined), {});
  assert.deepEqual(withReturn({ mood: 2 }, 'Sos'), { mood: 2 }, 'un parámetro no manda a cualquier pantalla');
  const nav = fakeNavigation();
  exitCheckin(nav, 'AdminPanel');
  assert.deepEqual(nav.calls, [['popToTop']]);
});
