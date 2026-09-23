// Pruebas de lo nuevo del panel de administración (contrato v2): cola con
// riesgo y motivo, reportes, descartar, quitar, estadísticas y avisos al
// autor.
//
//   bash api/run-tests.sh

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startApi, EN_REVISION } from './helpers.mjs';

const { cuenta, call, stop } = await startApi();

const autora = await cuenta('panel-autora@upb.edu.co', { name: 'Autora Panel' });
const lectores = [
  await cuenta('panel-l1@upb.edu.co'),
  await cuenta('panel-l2@upb.edu.co'),
  await cuenta('panel-l3@upb.edu.co'),
];
const mod = await cuenta('panel-mod@upb.edu.co', { role: 'moderator' });
const admin = await cuenta('panel-admin@upb.edu.co', { role: 'admin' });

test.after(stop);

// Solo letras: una marca con 7 dígitos seguidos parecería un teléfono y el
// filtro retendría la publicación.
const uid = () => Array.from({ length: 10 }, () => 'abcdefghjkmnpqrstuvwxyz'[crypto.randomInt(23)]).join('');
const publicar = async (body, extra = {}) =>
  (await call('POST', '/posts', autora.token, { body, ...extra })).body.post;

test('la cola trae riesgo, nota, motivo y conteo de reportes, con la crisis primero', async () => {
  const revision = await publicar(`revisión ${uid()}${EN_REVISION}`);
  const crisis = await publicar('me quiero morir');

  const { posts } = (await call('GET', '/admin/queue', admin.token)).body;
  const item = posts.find((p) => p.id === crisis.id);
  assert.equal(item.risk, 'high');
  assert.equal(item.held_reason, 'crisis');
  assert.match(item.screening_note, /^crisis/);
  assert.equal(item.report_count, 0);
  assert.ok(posts.findIndex((p) => p.id === crisis.id) < posts.findIndex((p) => p.id === revision.id));
  // Todo lo 'high' antes que cualquier otra cosa.
  const primeraNoCrisis = posts.findIndex((p) => p.risk !== 'high');
  assert.ok(posts.slice(primeraNoCrisis === -1 ? posts.length : primeraNoCrisis).every((p) => p.risk !== 'high'));
});

test('aprobar y rechazar avisan al autor', async () => {
  const a = await publicar(`para aprobar ${uid()}${EN_REVISION}`);
  const b = await publicar(`para rechazar ${uid()}${EN_REVISION}`);
  assert.equal((await call('POST', `/admin/posts/${a.id}/moderate`, admin.token, { action: 'publish' })).status, 200);
  assert.equal((await call('POST', `/admin/posts/${b.id}/moderate`, admin.token, { action: 'reject' })).status, 200);

  const notis = (await call('GET', '/notifications', autora.token)).body.notifications;
  assert.ok(notis.some((n) => n.kind === 'post_approved' && n.post_id === a.id && n.actor === null));
  assert.ok(notis.some((n) => n.kind === 'post_rejected' && n.post_id === b.id));

  const otraVez = await call('POST', `/admin/posts/${b.id}/moderate`, admin.token, { action: 'publish' });
  assert.equal(otraVez.status, 409, 'lo rechazado no se aprueba por accidente');
  assert.equal((await call('POST', `/admin/posts/${a.id}/moderate`, admin.token, { action: 'nada' })).status, 400);
});

test('quitar algo ya publicado lo saca del feed', async () => {
  const p = await publicar(`publicado y luego quitado ${uid()}`);
  assert.equal(p.status, 'published');
  assert.equal((await call('POST', `/admin/posts/${p.id}/moderate`, admin.token, { action: 'remove' })).status, 200);
  assert.equal((await call('GET', `/posts/${p.id}`, lectores[0].token)).status, 404);
  assert.equal((await call('GET', `/posts/${p.id}`, autora.token)).body.post.status, 'removed');
  assert.equal((await call('POST', `/admin/posts/${p.id}/moderate`, admin.token, { action: 'remove' })).status, 409);
});

test('comentarios: aprobar avisa, quitar saca de la lista', async () => {
  const p = await publicar(`post del panel ${uid()}`);
  const retenido = (await call('POST', `/posts/${p.id}/comments`, autora.token, { body: `hola${EN_REVISION}` })).body.comment;
  await call('POST', `/admin/comments/${retenido.id}/moderate`, admin.token, { action: 'publish' });
  const notis = (await call('GET', '/notifications', autora.token)).body.notifications;
  assert.ok(notis.some((n) => n.kind === 'comment_approved' && n.comment_id === retenido.id));

  const visible = (await call('POST', `/posts/${p.id}/comments`, lectores[0].token, { body: 'visible' })).body.comment;
  assert.equal((await call('POST', `/admin/comments/${visible.id}/moderate`, admin.token, { action: 'remove' })).status, 200);
  const lista = (await call('GET', `/posts/${p.id}/comments`, lectores[1].token)).body.comments;
  assert.ok(!lista.some((c) => c.id === visible.id));
});

test('reportes: el panel los ve sin decir quién reportó; descartarlos todos devuelve lo ocultado', async () => {
  const p = await publicar(`muy reportado ${uid()}`);
  for (const l of lectores) await call('POST', `/posts/${p.id}/report`, l.token, { reason: 'spam', detail: 'esto es spam' });
  assert.equal((await call('GET', `/posts/${p.id}`, lectores[0].token)).status, 404, 'oculto por el umbral');

  const { reports } = (await call('GET', '/admin/reports', admin.token)).body;
  const deEste = reports.filter((r) => r.post_id === p.id && r.target === 'post');
  assert.equal(deEste.length, 3);
  assert.equal(deEste[0].report_count, 3);
  assert.equal(deEste[0].held_reason, 'reports');
  assert.equal(deEste[0].detail, 'esto es spam');
  const json = JSON.stringify(deEste);
  for (const l of lectores) assert.ok(!json.includes(l.id), 'no dice quién reportó');

  const cola = (await call('GET', '/admin/queue', admin.token)).body.posts.find((x) => x.id === p.id);
  assert.equal(cola.report_count, 3);

  let ultimo;
  for (const r of deEste) ultimo = await call('POST', `/admin/reports/${r.id}/dismiss`, admin.token);
  assert.equal(ultimo.status, 200);
  assert.equal(ultimo.body.restored, true);
  assert.equal((await call('GET', `/posts/${p.id}`, lectores[0].token)).status, 200, 'vuelve a verse');

  assert.equal((await call('POST', `/admin/reports/${deEste[0].id}/dismiss`, admin.token)).status, 404, 'ya descartado');
});

test('reportes de comentarios aparecen en el panel', async () => {
  const p = await publicar(`post con comentario reportado ${uid()}`);
  const c = (await call('POST', `/posts/${p.id}/comments`, autora.token, { body: 'comentario' })).body.comment;
  await call('POST', `/posts/comments/${c.id}/report`, lectores[0].token, { reason: 'harassment' });
  const { reports } = (await call('GET', '/admin/reports', admin.token)).body;
  const r = reports.find((x) => x.comment_id === c.id);
  assert.equal(r.target, 'comment');
  assert.equal(r.post_id, p.id);
  assert.equal((await call('POST', `/admin/reports/${r.id}/dismiss`, admin.token)).status, 200);
});

test('estadísticas generales, sin nada del diario', async () => {
  const r = await call('GET', '/admin/stats', admin.token);
  assert.equal(r.status, 200);
  for (const k of ['users', 'posts', 'comments', 'open_reports', 'crisis_pending']) assert.ok(k in r.body, `falta ${k}`);
  assert.deepEqual(Object.keys(r.body.posts).sort(), ['pending', 'published', 'rejected', 'removed']);
  assert.ok(r.body.users >= 6);
  assert.ok(!/entr|journal|diario|mood/i.test(JSON.stringify(r.body)));
});

test('reportes, descartar y estadísticas exigen admin — un moderador no alcanza', async () => {
  for (const who of [lectores[0], mod]) {
    assert.equal((await call('GET', '/admin/reports', who.token)).status, 403);
    assert.equal((await call('GET', '/admin/stats', who.token)).status, 403);
    assert.equal((await call('POST', `/admin/reports/${crypto.randomUUID()}/dismiss`, who.token)).status, 403);
  }
});
