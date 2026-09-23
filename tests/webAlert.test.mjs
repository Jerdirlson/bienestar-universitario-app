// Confirmaciones en la versión web (src/lib/webAlert.js).
//
//   npm test
//
// react-native-web no implementa Alert.alert: sin esta traducción, borrar,
// bloquear o cerrar sesión con cambios pendientes no hacía nada en web, y el
// aviso del SOS con el número para marcar a mano no se mostraba.

import test from 'node:test';
import assert from 'node:assert/strict';

import { runWebAlert } from '../src/lib/webAlert.js';

function dialogs(answers = []) {
  const seen = { alerts: [], confirms: [] };
  return {
    seen,
    alert: (text) => { seen.alerts.push(text); },
    confirm: (text) => { seen.confirms.push(text); return answers.shift() ?? false; },
  };
}

test('web: un aviso sin botones se muestra con alert (el número del SOS se ve)', () => {
  const d = dialogs();
  runWebAlert('Línea 106', 'Comunícate directamente al 106.', undefined, d);
  assert.equal(d.seen.alerts.length, 1);
  assert.match(d.seen.alerts[0], /106\./);
  assert.equal(d.seen.confirms.length, 0);
});

test('web: cancelar + acción → confirm; aceptar ejecuta la acción y no cancelar', () => {
  const calls = [];
  const d = dialogs([true]);
  const ran = runWebAlert('¿Borrar?', 'No se puede deshacer.', [
    { text: 'Cancelar', style: 'cancel', onPress: () => calls.push('cancel') },
    { text: 'Borrar', style: 'destructive', onPress: () => calls.push('borrar') },
  ], d);
  assert.deepEqual(calls, ['borrar']);
  assert.equal(ran.text, 'Borrar');
  assert.equal(d.seen.confirms.length, 1);
});

test('web: si la persona no acepta, no se ejecuta la acción destructiva', () => {
  const calls = [];
  const d = dialogs([false]);
  runWebAlert('¿Bloquear?', null, [
    { text: 'Cancelar', style: 'cancel', onPress: () => calls.push('cancel') },
    { text: 'Bloquear', style: 'destructive', onPress: () => calls.push('bloquear') },
  ], d);
  assert.deepEqual(calls, ['cancel']);
});

test('web: con varias acciones se pregunta una por una hasta que se acepta', () => {
  const calls = [];
  const d = dialogs([false, true]);
  runWebAlert('Opciones', null, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Primera', onPress: () => calls.push(1) },
    { text: 'Segunda', onPress: () => calls.push(2) },
    { text: 'Tercera', onPress: () => calls.push(3) },
  ], d);
  assert.deepEqual(calls, [2]);
  assert.equal(d.seen.confirms.length, 2);
  assert.match(d.seen.confirms[1], /Segunda/);
});

test('web: una sola acción sin cancelar (p. ej. "Entendido") se ejecuta tras el alert', () => {
  const calls = [];
  const d = dialogs();
  runWebAlert('Listo', 'Tu cuenta fue eliminada.', [{ text: 'OK', onPress: () => calls.push('ok') }], d);
  assert.deepEqual(calls, ['ok']);
  assert.equal(d.seen.alerts.length, 1);
});
