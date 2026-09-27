// Moderación v2: protocolo de crisis (enviar apoyo, marcar como atendido) y
// apelación de lo rechazado.
//
//   bash api/run-tests.sh
//
// Lo que más importa probar acá no es "funciona" — es que "enviar apoyo"
// jamás revela author_id al moderador (ni en la respuesta ni en la cola), que
// la nota interna de "atendido" nunca sale en el contrato de quien escribió,
// que una apelación es una sola vez para siempre, y que sin SMTP configurado
// (el caso de estas pruebas) publicar algo en crisis nunca falla.

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startApi, EN_REVISION } from './helpers.mjs';

const { cuenta, call, stop } = await startApi();

const autora = await cuenta('modv2-autora@upb.edu.co', { name: 'Autora ModV2' });
const lector = await cuenta('modv2-lector@upb.edu.co');
const mod = await cuenta('modv2-mod@upb.edu.co', { role: 'moderator' });
const admin = await cuenta('modv2-admin@upb.edu.co', { role: 'admin' });

test.after(stop);

const uid = () => Array.from({ length: 10 }, () => 'abcdefghjkmnpqrstuvwxyz'[crypto.randomInt(23)]).join('');
const publicar = async (body, extra = {}) =>
  (await call('POST', '/posts', autora.token, { body, ...extra })).body.post;
const comentar = async (postId, body) =>
  (await call('POST', `/posts/${postId}/comments`, autora.token, { body })).body.comment;

// ── enviar apoyo ─────────────────────────────────────────────────────────

test('enviar apoyo: crea la notificación al autor, una sola vez, sin filtrar quién es', async () => {
  const crisis = await publicar('me quiero morir, no aguanto más');
  assert.equal(crisis.held_reason, 'crisis');
  const cola = (await call('GET', '/admin/queue', mod.token)).body;
  const item = cola.posts.find((p) => p.id === crisis.id);
  assert.equal(item.held_reason, 'crisis');
  assert.equal(item.support_sent_at, null);
  // Nada de la cola completa delata a la autora.
  assert.ok(!JSON.stringify(cola).includes(autora.id));

  const enviar = await call('POST', `/admin/posts/${crisis.id}/support`, mod.token);
  assert.equal(enviar.status, 200);

  const otraVez = await call('POST', `/admin/posts/${crisis.id}/support`, mod.token);
  assert.equal(otraVez.status, 409, 'una sola vez por publicación');

  const notis = (await call('GET', '/notifications', autora.token)).body.notifications;
  const aviso = notis.find((n) => n.kind === 'support_sent');
  assert.ok(aviso, 'el autor recibe el aviso de apoyo');
  assert.equal(aviso.actor, null, 'sin actor: no delata al moderador');
  assert.equal(aviso.excerpt, null, 'sin excerpt: no repite lo que escribió');

  const colaDespues = (await call('GET', '/admin/queue', mod.token)).body;
  assert.ok(colaDespues.posts.find((p) => p.id === crisis.id).support_sent_at, 'la cola sí ve que ya se envió');
});

test('enviar apoyo sobre algo que no está en crisis, o que no existe, no hace nada raro', async () => {
  const normal = await publicar(`nada de riesgo ${uid()}`);
  const r = await call('POST', `/admin/posts/${normal.id}/support`, mod.token);
  assert.equal(r.status, 409);

  const inexistente = await call('POST', `/admin/posts/${crypto.randomUUID()}/support`, mod.token);
  assert.equal(inexistente.status, 409);
});

test('enviar apoyo también funciona sobre un comentario en crisis', async () => {
  const post = await publicar(`post con comentario en crisis ${uid()}`);
  const comentario = await comentar(post.id, 'quiero suicidarme');
  const r = await call('POST', `/admin/comments/${comentario.id}/support`, mod.token);
  assert.equal(r.status, 200);
  const notis = (await call('GET', '/notifications', autora.token)).body.notifications;
  assert.ok(notis.some((n) => n.kind === 'support_sent'));
});

// ── marcar como atendido ────────────────────────────────────────────────

test('marcar como atendido guarda la nota interna, y esa nota NUNCA sale en el contrato del autor', async () => {
  const crisis = await publicar('quiero desaparecer para siempre');
  const atender = await call('POST', `/admin/posts/${crisis.id}/attend`, mod.token, { note: 'se contactó por WhatsApp, está acompañada' });
  assert.equal(atender.status, 200);

  const propio = await call('GET', `/posts/${crisis.id}`, autora.token);
  assert.ok(!JSON.stringify(propio.body).includes('WhatsApp'), 'la nota interna no llega al autor');

  const cola = (await call('GET', '/admin/queue', mod.token)).body;
  const item = cola.posts.find((p) => p.id === crisis.id);
  assert.equal(item.crisis_handled_note, 'se contactó por WhatsApp, está acompañada');
  assert.ok(item.crisis_handled_at);
});

test('atender sin nota funciona, y una nota de más de 500 caracteres se rechaza', async () => {
  const crisis = await publicar('ya no quiero seguir viviendo');
  const sinNota = await call('POST', `/admin/posts/${crisis.id}/attend`, mod.token, {});
  assert.equal(sinNota.status, 200);

  const otraCrisis = await publicar('mejor me muero');
  const notaLarga = await call('POST', `/admin/posts/${otraCrisis.id}/attend`, mod.token, { note: 'a'.repeat(501) });
  assert.equal(notaLarga.status, 400);
});

// ── rol moderador: la cola y las acciones de crisis sí, el resto no ──────

test('un moderador usa la cola, los reportes y el protocolo de crisis; un lector, nada de eso', async () => {
  const crisis = await publicar('quiero acabar con todo, ya no puedo más');
  for (const ruta of [
    ['GET', '/admin/queue'],
    ['GET', '/admin/reports'],
    ['POST', `/admin/posts/${crisis.id}/support`],
    ['POST', `/admin/posts/${crisis.id}/attend`],
  ]) {
    const [method, path] = ruta;
    assert.equal((await call(method, path, lector.token)).status, 403, `${method} ${path} debe rechazar a un lector`);
    assert.equal((await call(method, path, mod.token)).status, 200, `${method} ${path} debe aceptar a un moderador`);
  }
});

// ── apelación ────────────────────────────────────────────────────────────

test('apelar lo rechazado vuelve a la cola marcado como apelación, y solo funciona una vez', async () => {
  const post = await publicar(`para apelar ${uid()}${EN_REVISION}`);
  assert.equal((await call('POST', `/admin/posts/${post.id}/moderate`, admin.token, { action: 'reject' })).status, 200);

  const primera = await call('POST', `/posts/${post.id}/appeal`, autora.token);
  assert.equal(primera.status, 200);
  assert.equal(primera.body.post.status, 'pending');
  assert.equal(primera.body.post.held_reason, 'appeal');
  assert.equal(primera.body.post.appealed, true);

  // aparece de nuevo en la cola del panel
  const cola = (await call('GET', '/admin/queue', mod.token)).body;
  assert.ok(cola.posts.some((p) => p.id === post.id && p.held_reason === 'appeal'));

  const segundaInmediata = await call('POST', `/posts/${post.id}/appeal`, autora.token);
  assert.equal(segundaInmediata.status, 409, 'no se apela dos veces seguidas');

  // Ni aunque un moderador la rechace de nuevo: appealed_at no se limpia.
  assert.equal((await call('POST', `/admin/posts/${post.id}/moderate`, admin.token, { action: 'reject' })).status, 200);
  const segunda = await call('POST', `/posts/${post.id}/appeal`, autora.token);
  assert.equal(segunda.status, 409, 'una apelación es para siempre, no por decisión');
});

test('apelar algo que no está rechazado, o que no es propio, falla con 409', async () => {
  const post = await publicar(`todavia pendiente o publicada ${uid()}`);
  assert.equal((await call('POST', `/posts/${post.id}/appeal`, autora.token)).status, 409);
  assert.equal((await call('POST', `/posts/${post.id}/appeal`, lector.token)).status, 409);
});

test('apelar un comentario rechazado también funciona, una sola vez', async () => {
  const post = await publicar(`post con comentario apelable ${uid()}`);
  const comentario = await comentar(post.id, `comentario a rechazar${EN_REVISION}`);
  assert.equal((await call('POST', `/admin/comments/${comentario.id}/moderate`, admin.token, { action: 'reject' })).status, 200);

  const r = await call('POST', `/posts/comments/${comentario.id}/appeal`, autora.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.comment.held_reason, 'appeal');

  assert.equal((await call('POST', `/posts/comments/${comentario.id}/appeal`, autora.token)).status, 409);
});

// ── alertas sin SMTP ────────────────────────────────────────────────────

test('sin SMTP configurado (como en estas pruebas), retener algo por crisis nunca rompe la petición', async () => {
  const r = await call('POST', '/posts', autora.token, { body: 'ya no quiero seguir viviendo, quiero morirme', isAnonymous: true });
  assert.equal(r.status, 201);
  assert.equal(r.body.moderation.reason, 'crisis');

  // Editar hacia crisis tampoco falla por la alerta.
  const limpio = await publicar(`texto limpio para editar ${uid()}`);
  const editar = await call('PATCH', `/posts/${limpio.id}`, autora.token, { body: 'me quiero morir de verdad' });
  assert.equal(editar.status, 200);
  assert.equal(editar.body.moderation.reason, 'crisis');
});
