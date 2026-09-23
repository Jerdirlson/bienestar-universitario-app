// Emociones del check-in (src/lib/feelings.js y feelingItems en i18n).
//
//   npm test
//
// El paso 2 del check-in exige elegir al menos una emoción. Si la lista solo
// tuviera emociones positivas, quien registra "Muy mal" tendría que marcar
// "Feliz" para poder terminar — y su histórico mentiría.

import test from 'node:test';
import assert from 'node:assert/strict';

import { COPY } from '../src/i18n.js';
import { orderFeelings } from '../src/lib/feelings.js';

test('hay emociones de un día difícil, con las mismas claves en ambos idiomas', () => {
  const hard = (lang) => COPY[lang].feelingItems.filter((i) => i.hard).map((i) => i.k);
  assert.ok(hard('es').length >= 5, 'faltan emociones difíciles');
  assert.deepEqual(hard('es'), hard('en'));
  for (const k of ['triste', 'ansioso', 'estresado']) assert.ok(hard('es').includes(k), k);
});

test('con ánimo bajo aparecen primero las difíciles; con ánimo bueno, las positivas', () => {
  const items = COPY.es.feelingItems;
  assert.equal(orderFeelings(items, 0)[0].hard, true);
  assert.equal(orderFeelings(items, 2)[0].hard, true);
  assert.ok(!orderFeelings(items, 3)[0].hard);
  assert.ok(!orderFeelings(items, 4)[0].hard);
  // Solo cambia el orden: nunca se pierde ninguna.
  for (const m of [0, 1, 2, 3, 4, null]) {
    assert.deepEqual(orderFeelings(items, m).map((i) => i.k).sort(), items.map((i) => i.k).sort());
  }
});
