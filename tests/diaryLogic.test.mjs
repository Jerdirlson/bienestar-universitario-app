// Detección local de señales de riesgo y estadísticas de Progreso.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { screenText, hasCrisisSignals, normalizeForScreening } from '../src/lib/crisisSignals.js';
import { moodSeries, topKeys, periodStats, longestStreak } from '../src/lib/insights.js';

// ── señales de riesgo ────────────────────────────────────────────────────────
//
// Si una de estas deja de detectarse, alguien que escribe algo grave en su
// diario deja de ver el acceso a la línea de apoyo.

const RISKY = [
  'Me quiero morir',
  'ya no quiero vivir así',
  'Quiero morirme, no aguanto más',
  'a veces pienso en suicidarme',
  'He pensado en el suicidio',
  'quisiera quitarme la vida',
  'me voy a matar',
  'ganas de matarme',
  'quiero acabar con mi vida',
  'no quiero seguir viviendo',
  'sería mejor estar muerta',
  'ojalá no despertar mañana',
  'quiero hacerme daño',
  'volví a cortarme las venas',
  'me corto los brazos cuando estoy mal',
  'todos estarían mejor sin mí',
  'nadie me extrañaría',
  'QUIEROOO MORIRRR',
  'la vida no vale la pena',
  'I want to kill myself',
  "I don't want to live anymore",
  'thinking about suicide',
  'I keep hurting myself',
  'everyone would be better off without me',
  'I just want to die',
  'self-harm again',
];

const SAFE = [
  'me muero de la risa con mis amigos',
  'Me muero de hambre, no almorcé',
  'me muero de sueño en clase',
  'me muero por verte el viernes',
  'me voy a matar estudiando para el parcial',
  'casi me muero de la vergüenza',
  'hoy me corté el pelo',
  'voy a cortarme el cabello mañana',
  'no quiero morir sin conocer Japón',
  'leí sobre prevención del suicidio en la clase de psicología',
  'estoy muerto de cansancio',
  'I was dying of laughter',
  "I'm dying to see the new movie",
  'we watched Suicide Squad',
  'hoy fue un buen día, gracias a mi familia',
  'Estoy agradecido por el café, el sol y mi perro',
  '',
];

test('detecta frases de riesgo en español e inglés', () => {
  for (const text of RISKY) {
    assert.equal(screenText(text).risk, true, `no detectó: "${text}"`);
  }
});

test('no se activa con exageraciones cotidianas ni textos neutros', () => {
  for (const text of SAFE) {
    assert.equal(screenText(text).risk, false, `falso positivo: "${text}" → ${screenText(text).matches}`);
  }
});

test('una exageración no oculta una frase de riesgo en el mismo texto', () => {
  assert.equal(screenText('me muero de la risa con ellos, pero en el fondo me quiero morir').risk, true);
});

test('normaliza tildes, mayúsculas y letras alargadas', () => {
  assert.equal(normalizeForScreening('¡Ahí ESTÁÁÁ!'), ' ahi esta ');
});

test('hasCrisisSignals revisa varios textos y tolera vacíos', () => {
  assert.equal(hasCrisisSignals('', null, 'quiero morir'), true);
  assert.equal(hasCrisisSignals(undefined, 'todo bien'), false);
});

// ── estadísticas ─────────────────────────────────────────────────────────────

const TODAY = new Date(2026, 8, 23, 10, 0); // 23 sep 2026
const e = (entryDate, mood, feelings = [], causes = []) => ({ entryDate, mood, feelings, causes });

test('moodSeries da un punto por día, con null donde no hubo registro', () => {
  const s = moodSeries([e('2026-09-23', 4), e('2026-09-21', 1)], 3, TODAY);
  assert.deepEqual(s, [
    { date: '2026-09-21', mood: 1 },
    { date: '2026-09-22', mood: null },
    { date: '2026-09-23', mood: 4 },
  ]);
});

test('periodStats promedia solo la ventana y compara con la anterior', () => {
  const entries = [
    e('2026-09-23', 4, ['feliz'], ['amigos']),
    e('2026-09-20', 2, ['feliz', 'tranquilo'], ['estudios']),
    e('2026-09-17', 3, [], ['estudios']),   // dentro de 7 días (17..23)
    e('2026-09-15', 0, ['tranquilo'], []),  // semana anterior
    e('2026-09-10', 2),                     // semana anterior
    e('2026-08-01', 4),                     // fuera
  ];
  const st = periodStats(entries, 7, TODAY);
  assert.equal(st.count, 3);
  assert.equal(st.average, 3);
  assert.equal(st.previousAverage, 1);
  assert.equal(st.delta, 2);
  assert.deepEqual(st.distribution, [0, 0, 1, 1, 1]);
  assert.deepEqual(st.topFeelings[0], { k: 'feliz', count: 2 });
  assert.deepEqual(st.topCauses[0], { k: 'estudios', count: 2 });
  assert.equal(st.series.length, 7);
});

test('periodStats sin datos no inventa promedios', () => {
  const st = periodStats([], 30, TODAY);
  assert.equal(st.count, 0);
  assert.equal(st.average, null);
  assert.equal(st.delta, null);
  assert.deepEqual(st.topFeelings, []);
});

test('topKeys ordena por frecuencia y limita', () => {
  const t = topKeys([e('a', 1, ['x', 'y']), e('b', 1, ['y', 'z']), e('c', 1, ['y'])], 'feelings', 2);
  assert.deepEqual(t, [{ k: 'y', count: 3 }, { k: 'x', count: 1 }]);
});

test('longestStreak encuentra la racha más larga, cruzando meses', () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak([e('2026-08-30', 1), e('2026-08-31', 1), e('2026-09-01', 1), e('2026-09-05', 1)]), 3);
});
