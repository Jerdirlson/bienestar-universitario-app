// Pruebas del filtro de moderación automática. Puro: no necesita base.
//
//   cd api && node --test tests/moderation.test.mjs
//
// El orden de lo que importa: primero que el riesgo de autolesión NUNCA se
// publique solo (un falso negativo acá es lo más caro), después que los
// modismos obvios no se traten como crisis (un falso positivo le muestra el
// SOS a alguien que solo se estaba riendo).

import test from 'node:test';
import assert from 'node:assert/strict';
import { screen, normalize } from '../src/moderation.js';

const crisis = (text) => {
  const r = screen(text);
  assert.deepEqual(
    { outcome: r.outcome, risk: r.risk, reason: r.reason },
    { outcome: 'held', risk: 'high', reason: 'crisis' },
    `debió ser crisis: "${text}" → ${JSON.stringify(r)}`
  );
};

const review = (text) => {
  const r = screen(text);
  assert.deepEqual(
    { outcome: r.outcome, reason: r.reason },
    { outcome: 'held', reason: 'review' },
    `debió quedar en revisión: "${text}" → ${JSON.stringify(r)}`
  );
  assert.equal(r.risk, 'low');
};

const clean = (text) => {
  const r = screen(text);
  assert.deepEqual(
    r,
    { outcome: 'published', risk: 'none', reason: null, note: 'filtro: sin hallazgos' },
    `debió publicarse: "${text}" → ${JSON.stringify(r)}`
  );
};

// ── forma del resultado ────────────────────────────────────────────────────

test('devuelve siempre las cuatro claves', () => {
  for (const text of ['hola', 'me quiero morir', 'eres un idiota', '', null, undefined]) {
    const r = screen(text);
    assert.deepEqual(Object.keys(r).sort(), ['note', 'outcome', 'reason', 'risk']);
  }
});

test('texto vacío o nulo no rompe y se trata como limpio', () => {
  clean('');
  clean('   ');
  clean(null);
});

// ── normalización ──────────────────────────────────────────────────────────

test('normaliza tildes, mayúsculas, repeticiones y leetspeak', () => {
  assert.equal(normalize('ME QUIERO MORÍÍÍR'), ' me quiero morir ');
  assert.equal(normalize('m4t4rm3'), ' matarme ');
  assert.equal(normalize('s.u.i.c.i.d.i.o'), ' suicidio ');
  assert.equal(normalize('s u i c i d i o'), ' suicidio ');
  // Los números de verdad no se tocan.
  assert.equal(normalize('tengo 3 parciales'), ' tengo 3 parciales ');
});

// ── crisis: español ────────────────────────────────────────────────────────

test('crisis: ideación suicida explícita en español', () => {
  crisis('Ya no puedo más, me quiero morir');
  crisis('quiero morirme');
  crisis('He pensado en el suicidio');
  crisis('pienso en suicidarme todos los días');
  crisis('me voy a matar');
  crisis('Hoy me quiero matar');
  crisis('Quisiera quitarme la vida');
  crisis('voy a acabar con mi vida');
  crisis('no quiero seguir viviendo');
  crisis('no quiero vivir más');
  crisis('Estaría mejor muerta');
  crisis('ojalá no despertar mañana');
  crisis('no tengo razones para vivir');
  crisis('nadie me extrañaría');
  crisis('estoy escribiendo mi carta de despedida');
  crisis('tengo ganas de morir');
});

test('crisis: autolesión en español', () => {
  crisis('me corto los brazos cuando estoy así');
  crisis('volví a cortarme');
  crisis('quiero hacerme daño');
  crisis('pienso en lastimarme');
  crisis('me quiero tirar de un puente');
  crisis('he pensado en tirarme por la ventana');
  crisis('quiero tomarme todas las pastillas');
  crisis('autolesión otra vez');
  crisis('pienso en ahorcarme');
});

test('crisis: variantes escritas para esquivar el filtro', () => {
  crisis('me quiero moriiiiir');
  crisis('M3 QU13R0 M0R1R');
  crisis('s-u-i-c-i-d-i-o');
  crisis('m a t a r m e');
  crisis('QUIERO MORIRME!!!');
});

// ── crisis: inglés ─────────────────────────────────────────────────────────

test('crisis: inglés', () => {
  crisis('I want to die');
  crisis('i wanna die');
  crisis("I'm going to kill myself");
  crisis('thinking about ending my life');
  crisis('I have been self-harming, I cut myself again');
  crisis('I would be better off dead');
  crisis("I don't want to live anymore");
  crisis('i feel suicidal');
  crisis('I just want to end it all');
});

// ── falsos positivos que NO deben ser crisis ───────────────────────────────

test('modismos: morirse de risa, sueño, pena no son crisis', () => {
  clean('me muero de la risa con este meme');
  clean('me estoy muriendo de sueño en clase');
  clean('me quiero morir de la pena, me caí frente a todos');
  clean('muerta de hambre después del laboratorio');
  clean('casi me muero del susto');
});

test('modismos: matar el tiempo, el parcial me mata, me mato estudiando', () => {
  clean('voy a matar el tiempo antes de clase');
  clean('para matar el tiempo leo');
  clean('este parcial me mata');
  clean('el profe de cálculo me va a matar');
  clean('mi mamá va a matarme si pierdo la materia');
  clean('me mato estudiando y nada');
  clean('me voy a cortar el pelo mañana');
  clean('quiero cortarme el pelo');
  clean('me tomé una sobredosis de café');
});

test('modismos en inglés no son crisis', () => {
  clean('I was dying of laughter');
  clean("I'm dying to see the new movie");
  clean('you killed it in the presentation');
  clean('just killing time before class');
  clean('this cake is to die for');
});

test('hablar de emociones difíciles sin riesgo se publica', () => {
  clean('Hoy me sentí muy ansioso antes del parcial, pero respiré y pasó.');
  clean('Estoy triste porque terminé con mi pareja');
  clean('Me siento solo en la universidad, ¿a alguien más le pasa?');
  clean('Tuve un ataque de ansiedad y fui a Bienestar, me ayudaron mucho');
  clean('Ya no puedo más con este semestre');
  clean('soy una tonta, olvidé entregar el taller');
  clean('I feel anxious about finals');
  clean('Gané el parcial de física 🎉');
  clean('El 2026 va a ser mejor, tengo 3 metas');
});

// ── acoso, amenazas y odio ─────────────────────────────────────────────────

test('insultos dirigidos quedan en revisión', () => {
  review('eres un idiota');
  review('Eres una estúpida');
  review('ustedes son unos inútiles');
  review('pedazo de imbécil');
  review('qué gonorrea tan malparida');
  review('hijueputa');
  review('you are so stupid');
  review('shut up you idiot');
  review('eres un 1d10t4');
});

test('amenazas y deseos de muerte a otra persona quedan en revisión', () => {
  review('te voy a matar');
  review('sé dónde vives');
  review('te espero a la salida');
  review('mátate');
  review('ojalá te mueras');
  review('nadie te quiere');
  review('kill yourself');
  review('kys');
  review('I know where you live');
});

test('discurso de odio queda en revisión', () => {
  review('esos venecos');
  review('los gays deberían desaparecer');
  review('las mujeres son inferiores');
  review('maricón');
});

test('groserías sueltas no dirigidas a nadie no bastan para retener', () => {
  clean('qué mierda de día');
  clean('estoy harto, marica, qué semestre tan duro');
});

// ── datos personales ───────────────────────────────────────────────────────

test('correos, teléfonos, cédulas, direcciones, usuarios y enlaces quedan en revisión', () => {
  review('escríbeme a juanita.perez@gmail.com');
  review('mi correo es juan arroba gmail.com');
  review('llámame al 300 123 4567');
  review('mi cel 3001234567');
  review('+57 315-555-1234');
  review('mi cédula es 1.098.765.432');
  review('cc 1098765');
  review('vivo en la calle 45 # 23-10');
  review('carrera 27 no. 10-45');
  review('torre 3 apto 502');
  review('sígueme en @juanito_23');
  review('mira https://example.com/algo');
  review('entra a www.algo.co');
  review('bit.ly/xyz');
  review('mi insta es juanito23');
});

test('números que no son datos personales no retienen', () => {
  clean('me cobraron 1.500.000 de matrícula');
  clean('el parcial es el 23.09.2026');
  clean('saqué 4.5 en el quiz');
  clean('somos 30 en el salón y 2 profes');
  clean('estoy cansada. nos vemos mañana');
});

test('la nota nunca repite el dato personal detectado', () => {
  const r = screen('escríbeme a juanita.perez@gmail.com');
  assert.equal(r.note, 'datos personales: correo');
  assert.ok(!r.note.includes('@'));
  const t = screen('llámame al 3001234567');
  assert.ok(!/\d/.test(t.note));
});

test('crisis tiene prioridad sobre acoso y datos personales', () => {
  crisis('me quiero morir, escríbeme a ana@gmail.com');
  crisis('eres un idiota y yo me quiero morir');
});

test('la nota explica qué se encontró, para el panel', () => {
  assert.match(screen('me quiero morir').note, /^crisis:/);
  assert.match(screen('eres un idiota').note, /^acoso u odio:/);
});
