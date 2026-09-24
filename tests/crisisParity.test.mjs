// El filtro de crisis del servidor (api/src/moderation.js, para lo que se
// publica) y el detector local del diario (src/lib/crisisSignals.js) son dos
// implementaciones; esta prueba les pasa el MISMO corpus para que no se
// desalineen. Si una frase de crisis la detecta uno y el otro no, alguien
// deja de ver el acceso al SOS en un lado de la app.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { screen } from '../api/src/moderation.js';
import { screenText } from '../src/lib/crisisSignals.js';

const serverCrisis = (t) => screen(t).reason === 'crisis';
const clientCrisis = (t) => screenText(t).risk;

// Evasiones Unicode: espacio de ancho cero en medio y letras de ancho completo.
const ZWSP = String.fromCharCode(0x200b);
const fullWidth = (s) => [...s].map((c) => (c === ' ' ? c : String.fromCharCode(c.charCodeAt(0) + 0xfee0))).join('');

const CRISIS = [
  'me quiero morir',
  'me quiero quitar la vida',
  'me voy a quitar la vida',
  'quiero acabar con todo',
  'quiero estar muerto',
  'quisiera estar muerta',
  'quiero dormir y no despertar',
  'mejor me muero',
  'quiero desaparecer',
  'me quiero cortar',
  'me corto',
  'cuando estoy así me corto',
  'voy a tomar todas mis pastillas',
  'kms',
  'honestly kms',
  'going to end it',
  "I'm going to end it tonight",
  `sui${ZWSP}cidio`,
  `pienso en el sui${ZWSP}cidio`,
  fullWidth('suicidio'),
  fullWidth('me quiero morir'),
  'me muero de ganas de morir',
  'me muero de la risa, pero en el fondo me quiero morir',
  'pienso en suicidarme',
  'I want to kill myself',
];

const NOT_CRISIS = [
  'me muero de la risa',
  'me muero de la risa con este meme',
  'me muero de ganas de verte',
  'me quiero morir de la pena',
  'voy a matar el tiempo antes de clase',
  'matar el tiempo',
  'este parcial me mata',
  'me voy a matar estudiando',
  'me voy a cortar el pelo',
  'me corto el pelo los sábados',
  'quiero acabar con todo el taller hoy',
  'hoy corrí 5 kms',
  "I'm dying of laughter",
  'just killing time before class',
  'hoy fue un buen día',
];

test('paridad: toda frase de crisis la detectan el servidor Y el teléfono', () => {
  for (const t of CRISIS) {
    assert.ok(serverCrisis(t), `el servidor no detectó: ${JSON.stringify(t)} → ${JSON.stringify(screen(t))}`);
    assert.ok(clientCrisis(t), `el teléfono no detectó: ${JSON.stringify(t)}`);
  }
});

test('paridad: ningún modismo es crisis ni en el servidor ni en el teléfono', () => {
  for (const t of NOT_CRISIS) {
    assert.ok(!serverCrisis(t), `falso positivo del servidor: ${JSON.stringify(t)} → ${screen(t).note}`);
    assert.ok(!clientCrisis(t), `falso positivo del teléfono: ${JSON.stringify(t)} → ${screenText(t).matches}`);
  }
});
