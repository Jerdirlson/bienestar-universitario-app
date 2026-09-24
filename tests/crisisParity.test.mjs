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
  // Frases coloquiales que se verificaron a mano y no coincidían en un lado o en ninguno.
  'no le veo sentido a seguir viviendo',
  'no tiene sentido seguir viviendo',
  'ya no quiero seguir viviendo',
  'no quiero seguir aquí',
  'he pensado en ahorcarme',
  'pienso en colgarme',
  'quiero tirarme del edificio',
  'me quiero lanzar a la calle cuando pase un carro',
  'nadie me va a extrañar',
  'todos estarían mejor sin mí',
  'no vale la pena vivir',
  "life isn't worth living",
  'no reason to keep living',
  "I've been thinking about hanging myself",
  'everyone would be better off without me',
  // Revisión posterior: patrones nuevos que faltaban por cubrir.
  'ya me cansé de vivir',
  'estoy cansada de vivir',
  'quiero que todo termine',
  'necesito que todo acabe',
  'quiero que todo termine ya',
  'estoy cansada de la vida',
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
  // Mismas palabras que las frases de crisis, en un contexto inofensivo.
  'me colgué con el trabajo',
  'cuelgo la ropa',
  'me tiré a la piscina',
  'me lancé a hablarle',
  'vale la pena vivir la experiencia',
  'no le veo sentido a esta materia',
  "I'm hanging out with friends",
  'hang in there',
  // Revisión posterior: los patrones nuevos de la ronda anterior marcaban
  // estas frases como crisis solo por contener la palabra clave, sin mirar
  // el contexto que la vuelve inofensiva.
  'no quiero estar aquí en esta clase tan aburrida',
  'no quiero estar aquí en esta reunión tan aburrida',
  'hoy toca lanzarme a la calle a buscar trabajo',
  'me voy a tirar a la calle a celebrar',
  'colgarme la mochila',
  'voy a colgarme la chaqueta antes de salir',
  'no le veo sentido a vivir en Bogotá',
  'no le veo sentido a vivir en esta ciudad',
  // Revisión posterior: "que todo/esto termine/acabe" y "cansado de vivir"
  // solo son crisis sin un complemento detrás; con uno, hablan de otra cosa.
  'quiero que esto termine rápido, qué clase tan larga',
  'necesito que esto acabe pronto para poder descansar',
  'necesito que todo acabe en el examen de mañana',
  'quiero que todo termine bien en el parcial',
  'quiero que todo termine pronto para ir a casa',
  'necesito que esto acabe rápido antes de que llueva',
  'estoy cansado de vivir con mis papás',
  'estoy cansado de vivir en esta ciudad tan ruidosa',
  'me cansé de vivir así, sin poder salir',
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
