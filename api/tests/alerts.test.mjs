// Alertas de crisis a moderadores DENTRO de la app (api/src/alerts.js →
// notificación `moderation_alert`, migración …_moderator_alerts.sql). Antes,
// la única alerta era un correo (api/src/mailer.js); sin SMTP configurado
// (el caso de estas pruebas, como el resto de la suite) no llegaba a ningún
// lado — solo un log. Lo que importa probar acá:
//   · moderador y admin la reciben; un estudiante nunca.
//   · no se duplica si ya hay una `moderation_alert` sin leer (si no, la
//     campanita se llenaría con una fila por cada publicación retenida).
//   · el texto nunca repite lo escrito ni identifica a la autora.
//
//   bash api/run-tests.sh tests/alerts.test.mjs
//
// alertCrisisHeld() es fire-and-forget (posts.js la llama con setImmediate,
// después de responder al cliente — ver alerts.js). Publicar ya la dispara
// sola, pero estas pruebas la vuelven a invocar directamente e importada,
// para no depender de esa carrera para tener un momento determinista en el
// que ya corrió. Llamarla dos veces es inofensivo (la deduplicación vive en
// la base, no en el proceso) — el pequeño respiro antes de cada llamada le da
// tiempo de sobra al disparo interno de posts.js para terminar primero y
// evitar que ambas pasen el "no existe todavía" al mismo tiempo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './helpers.mjs';
import { alertCrisisHeld } from '../src/alerts.js';

const { cuenta, call, stop } = await startApi();

const autora = await cuenta('alerts-autora@upb.edu.co', { name: 'Autora Alerts' });
const estudiante = await cuenta('alerts-estudiante@upb.edu.co');
const mod = await cuenta('alerts-mod@upb.edu.co', { role: 'moderator' });
const admin = await cuenta('alerts-admin@upb.edu.co', { role: 'admin' });

test.after(stop);

const TEXTO_CRISIS = 'me quiero morir, no aguanto más';
const respiro = () => new Promise((r) => setTimeout(r, 300));

const publicarCrisis = async () => {
  const r = await call('POST', '/posts', autora.token, { body: TEXTO_CRISIS });
  assert.equal(r.body.post.held_reason, 'crisis', 'precondición: el filtro retuvo el post por crisis');
  return r.body.post;
};

const alertasDe = async (cuentaToken) =>
  (await call('GET', '/notifications', cuentaToken)).body.notifications.filter((n) => n.kind === 'moderation_alert');

test('moderador y admin reciben la alerta in-app; un estudiante nunca', async () => {
  await publicarCrisis();
  await respiro();
  await alertCrisisHeld();

  const [avisoMod] = await alertasDe(mod.token);
  assert.ok(avisoMod, 'el moderador recibe la alerta');
  assert.equal(avisoMod.read, false);

  const [avisoAdmin] = await alertasDe(admin.token);
  assert.ok(avisoAdmin, 'el admin también la recibe');

  const avisosEstudiante = await alertasDe(estudiante.token);
  assert.equal(avisosEstudiante.length, 0, 'un estudiante nunca recibe la alerta de moderación');
});

test('no se duplica mientras haya una moderation_alert sin leer', async () => {
  const antes = await alertasDe(mod.token);
  assert.equal(antes.length, 1, 'precondición: ya hay una sin leer, de la prueba anterior');

  await publicarCrisis();
  await respiro();
  await alertCrisisHeld();
  await alertCrisisHeld(); // el resumen horario reutiliza la misma regla de deduplicado

  const despues = await alertasDe(mod.token);
  assert.equal(despues.length, 1, 'sigue habiendo una sola: no se apila con la cola de crisis creciendo');
});

test('al leerla, la siguiente crisis retenida sí crea una alerta nueva', async () => {
  // No se comprueba aquí que quede en 0 justo después de marcar leído: un
  // disparo interno de una publicación anterior (fire-and-forget, ver nota
  // arriba) podría llegar tarde y crear una fila legítima sin leer antes de
  // que este test publique la suya. Lo que importa es que, al final, haya
  // exactamente una sin leer — no que se haya "duplicado" nada.
  await call('POST', '/notifications/read', mod.token);
  await respiro();

  await publicarCrisis();
  await respiro();
  await alertCrisisHeld();

  const sinLeer = (await alertasDe(mod.token)).filter((n) => !n.read);
  assert.equal(sinLeer.length, 1, 'una vez leída la anterior, se crea una nueva sin leer');
});

test('el texto de la alerta no lleva contenido de lo retenido ni identifica a nadie', async () => {
  const notis = await alertasDe(mod.token);
  assert.ok(notis.length > 0);
  for (const n of notis) {
    assert.equal(n.excerpt, null, 'sin excerpt: nunca repite lo que se escribió');
    assert.equal(n.actor, null, 'sin actor: nunca identifica a quien escribió ni a quien modera');
    assert.equal(n.post_id, null, 'no delata qué publicación quedó retenida');
    assert.equal(n.comment_id, null);
  }
  assert.ok(
    !JSON.stringify(notis).toLowerCase().includes('quiero morir'),
    'el texto de la publicación no aparece en ningún lado del aviso'
  );
});
