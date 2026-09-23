// Pruebas del contrato v2 de la comunidad (api/API.md): perfil público,
// filtro automático, feed, edición, reacciones con tipo, guardados, reportes,
// comentarios con respuestas y "me gusta", personas, seguimientos, bloqueos
// y notificaciones.
//
//   bash api/run-tests.sh
//
// Lo que más importa acá no es "funciona", es el anonimato: cada vez que algo
// anónimo sale del API, se comprueba que no lleve NADA que lo ligue a su
// autor — ni public_id, ni alias.

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startApi, EN_REVISION } from './helpers.mjs';

const { owner, cuenta, call, api, stop } = await startApi();

const ana = await cuenta('v2-ana@upb.edu.co', { name: 'Ana Prueba' });
const beto = await cuenta('v2-beto@upb.edu.co', { name: 'Beto Prueba' });
const caro = await cuenta('v2-caro@upb.edu.co'); // sin nombre: sin perfil público
const dani = await cuenta('v2-dani@upb.edu.co', { name: 'Dani Prueba' });
const admin = await cuenta('v2-admin@upb.edu.co', { role: 'admin' });

test.after(stop);

// Solo letras: una marca con 7 dígitos seguidos parecería un teléfono y el
// filtro retendría la publicación.
const uid = () => Array.from({ length: 10 }, () => 'abcdefghjkmnpqrstuvwxyz'[crypto.randomInt(23)]).join('');

async function publicar(who, body, extra = {}) {
  const r = await call('POST', '/posts', who.token, { body, ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}

/** Nada de lo que devuelve el API para algo anónimo debe nombrar a su autor. */
function sinRastroDe(obj, persona, nombre) {
  const json = JSON.stringify(obj);
  assert.ok(!json.includes(persona.publicId), `se filtró el public_id: ${json}`);
  assert.ok(!json.includes(nombre), `se filtró el alias: ${json}`);
}

// ── descubrimiento y perfil ──────────────────────────────────────────────

test('GET /meta responde sin sesión con la versión del API', async () => {
  const r = await call('GET', '/meta');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { api_version: 2 });
});

test('/auth/me trae el perfil ampliado', async () => {
  const r = await call('GET', '/auth/me', ana.token);
  assert.equal(r.status, 200);
  for (const k of ['id', 'email', 'display_name', 'role', 'locale', 'created_at', 'public_id', 'avatar_emoji', 'avatar_color', 'bio']) {
    assert.ok(k in r.body, `falta ${k}`);
  }
  assert.match(r.body.public_id, /^[a-z0-9]{10}$/);
  assert.equal(r.body.avatar_color, 'lilac');
});

test('PATCH /auth/profile es parcial y valida cada campo', async () => {
  const ok = await call('PATCH', '/auth/profile', dani.token, { avatarEmoji: '🌻', avatarColor: 'mint', bio: 'Hola, soy Dani' });
  assert.equal(ok.status, 200);
  const me = (await call('GET', '/auth/me', dani.token)).body;
  assert.equal(me.avatar_emoji, '🌻');
  assert.equal(me.avatar_color, 'mint');
  assert.equal(me.bio, 'Hola, soy Dani');
  assert.equal(me.display_name, 'Dani Prueba', 'lo que no se manda no cambia');

  assert.equal((await call('PATCH', '/auth/profile', dani.token, { avatarColor: 'negro' })).body.error, 'avatar_invalido');
  assert.equal((await call('PATCH', '/auth/profile', dani.token, { avatarEmoji: '🌻'.repeat(9) })).body.error, 'avatar_invalido');
  assert.equal((await call('PATCH', '/auth/profile', dani.token, { bio: 'x'.repeat(161) })).body.error, 'bio_invalida');
  assert.equal((await call('PATCH', '/auth/profile', dani.token, { locale: 'fr' })).body.error, 'locale_invalido');
  assert.equal((await call('PATCH', '/auth/profile', dani.token, { displayName: 'A' })).body.error, 'nombre_invalido');
});

test('PATCH /auth/profile ignora role aunque venga en el cuerpo', async () => {
  const r = await call('PATCH', '/auth/profile', dani.token, { locale: 'en', role: 'admin' });
  assert.equal(r.status, 200);
  const me = (await call('GET', '/auth/me', dani.token)).body;
  assert.equal(me.role, 'student');
  assert.equal(me.locale, 'en');
});

// ── publicar: filtro automático ──────────────────────────────────────────

test('algo sin riesgo se publica en el acto, con la forma completa del contrato', async () => {
  const { post, moderation } = await publicar(ana, `un buen día ${uid()}`, { topic: 'logros', mood: 3 });
  assert.deepEqual(moderation, { outcome: 'published', reason: null });
  assert.equal(post.status, 'published');
  assert.equal(post.topic, 'logros');
  for (const k of ['id', 'body', 'mood', 'topic', 'status', 'created_at', 'edited_at', 'author', 'author_name', 'is_own',
    'reactions', 'reaction_counts', 'my_reaction', 'reacted_by_me', 'comment_count', 'saved_by_me', 'held_reason']) {
    assert.ok(k in post, `falta ${k}`);
  }
  assert.deepEqual(post.reaction_counts, { abrazo: 0, fuerza: 0, te_entiendo: 0, inspira: 0 });
  assert.equal(post.author, null, 'anónimo por defecto');
  assert.equal(post.held_reason, null);

  const visto = await call('GET', `/posts/${post.id}`, beto.token);
  assert.equal(visto.status, 200);
  assert.equal(visto.body.post.is_own, false);
});

test('riesgo de autolesión queda retenido como crisis, y solo lo ve su autor', async () => {
  const { post, moderation } = await publicar(ana, 'ya no aguanto, me quiero morir');
  assert.deepEqual(moderation, { outcome: 'held', reason: 'crisis' });
  assert.equal(post.status, 'pending');
  assert.equal(post.held_reason, 'crisis');

  assert.equal((await call('GET', `/posts/${post.id}`, beto.token)).status, 404);
  const { rows } = await owner.query('select risk, screening_note from public.posts where id = $1', [post.id]);
  assert.equal(rows[0].risk, 'high');
  assert.match(rows[0].screening_note, /^crisis/);
});

test('acoso queda retenido para revisión', async () => {
  const { post, moderation } = await publicar(ana, 'eres un idiota');
  assert.deepEqual(moderation, { outcome: 'held', reason: 'review' });
  assert.equal(post.held_reason, 'review');
});

test('tema o ánimo inválidos se rechazan', async () => {
  assert.equal((await call('POST', '/posts', ana.token, { body: 'hola', topic: 'politica' })).body.error, 'tema_invalido');
  assert.equal((await call('POST', '/posts', ana.token, { body: 'hola', mood: 9 })).body.error, 'mood_invalido');
});

test('con nombre: author trae public_id, alias y avatar; author_name se mantiene', async () => {
  const { post } = await publicar(ana, `firmado ${uid()}`, { isAnonymous: false });
  assert.equal(post.author.public_id, ana.publicId);
  assert.equal(post.author.display_name, 'Ana Prueba');
  assert.ok(post.author.avatar_emoji);
  assert.equal(post.author_name, 'Ana Prueba');
});

test('un post anónimo no lleva nada que identifique a su autor, ni a otros ni a sí mismo', async () => {
  const { post } = await publicar(ana, `anónimo de verdad ${uid()}`);
  sinRastroDe(post, ana, 'Ana Prueba');
  const visto = (await call('GET', `/posts/${post.id}`, beto.token)).body;
  sinRastroDe(visto, ana, 'Ana Prueba');
  const feed = (await call('GET', '/posts?limit=50', beto.token)).body;
  sinRastroDe(feed.posts.find((p) => p.id === post.id), ana, 'Ana Prueba');
});

test('GET /posts/:id: 404 si no existe o el id no es válido', async () => {
  assert.equal((await call('GET', `/posts/${crypto.randomUUID()}`, ana.token)).status, 404);
  assert.equal((await call('GET', '/posts/no-es-un-id', ana.token)).status, 404);
});

// ── editar ───────────────────────────────────────────────────────────────

test('editar lo propio vuelve a pasar el filtro y marca edited_at', async () => {
  const { post } = await publicar(ana, `texto original ${uid()}`);
  const ok = await call('PATCH', `/posts/${post.id}`, ana.token, { body: 'texto editado', topic: 'estudios' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.post.body, 'texto editado');
  assert.equal(ok.body.post.topic, 'estudios');
  assert.ok(ok.body.post.edited_at);
  assert.deepEqual(ok.body.moderation, { outcome: 'published', reason: null });

  const riesgo = await call('PATCH', `/posts/${post.id}`, ana.token, { body: 'pienso en suicidarme' });
  assert.equal(riesgo.status, 200);
  assert.equal(riesgo.body.post.status, 'pending');
  assert.deepEqual(riesgo.body.moderation, { outcome: 'held', reason: 'crisis' });
  assert.equal((await call('GET', `/posts/${post.id}`, beto.token)).status, 404, 'deja de verse');
});

test('no se edita lo ajeno, ni lo rechazado', async () => {
  const { post } = await publicar(ana, `no me edites ${uid()}`);
  assert.equal((await call('PATCH', `/posts/${post.id}`, beto.token, { body: 'hackeado' })).status, 404);

  const retenido = await publicar(ana, `a rechazar ${uid()}${EN_REVISION}`);
  await call('POST', `/admin/posts/${retenido.post.id}/moderate`, admin.token, { action: 'reject' });
  const r = await call('PATCH', `/posts/${retenido.post.id}`, ana.token, { body: 'ahora sí, publícame' });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'no_editable');
});

// ── reacciones, guardados ────────────────────────────────────────────────

test('reacción con tipo: una por persona, volver a reaccionar cambia el tipo', async () => {
  const { post } = await publicar(ana, `reacciona ${uid()}`);
  assert.equal((await call('POST', `/posts/${post.id}/react`, beto.token, { kind: 'fuerza' })).status, 200);
  let visto = (await call('GET', `/posts/${post.id}`, beto.token)).body.post;
  assert.equal(visto.my_reaction, 'fuerza');
  assert.equal(visto.reacted_by_me, true);
  assert.equal(visto.reaction_counts.fuerza, 1);

  await call('POST', `/posts/${post.id}/react`, beto.token, { kind: 'inspira' });
  visto = (await call('GET', `/posts/${post.id}`, beto.token)).body.post;
  assert.deepEqual(visto.reaction_counts, { abrazo: 0, fuerza: 0, te_entiendo: 0, inspira: 1 });
  assert.equal(visto.reactions, 1);

  await call('POST', `/posts/${post.id}/react`, dani.token);
  visto = (await call('GET', `/posts/${post.id}`, dani.token)).body.post;
  assert.equal(visto.my_reaction, 'abrazo', 'sin kind, abrazo');
  assert.equal(visto.reactions, 2);

  assert.equal((await call('POST', `/posts/${post.id}/react`, beto.token, { kind: 'odio' })).body.error, 'reaccion_invalida');
  await call('DELETE', `/posts/${post.id}/react`, beto.token);
  visto = (await call('GET', `/posts/${post.id}`, beto.token)).body.post;
  assert.equal(visto.my_reaction, null);
});

test('guardar: aparece en /me/saved de quien guarda y en nadie más', async () => {
  const { post } = await publicar(ana, `guárdame ${uid()}`);
  assert.equal((await call('POST', `/posts/${post.id}/save`, beto.token)).status, 200);
  assert.equal((await call('POST', `/posts/${post.id}/save`, beto.token)).status, 200, 'idempotente');
  assert.equal((await call('GET', `/posts/${post.id}`, beto.token)).body.post.saved_by_me, true);

  const guardados = (await call('GET', '/me/saved', beto.token)).body;
  assert.ok(guardados.posts.some((p) => p.id === post.id));
  assert.ok('next_before' in guardados);
  assert.ok(!(await call('GET', '/me/saved', dani.token)).body.posts.some((p) => p.id === post.id));

  await call('DELETE', `/posts/${post.id}/save`, beto.token);
  assert.ok(!(await call('GET', '/me/saved', beto.token)).body.posts.some((p) => p.id === post.id));
});

test('no se guarda algo que no se puede ver', async () => {
  const { post } = await publicar(ana, `en cola ${uid()}${EN_REVISION}`);
  assert.equal((await call('POST', `/posts/${post.id}/save`, beto.token)).status, 404);
});

// ── feed ─────────────────────────────────────────────────────────────────

test('feed: filtro por tema, búsqueda sin tildes ni mayúsculas, y paginación', async () => {
  const marca = uid();
  const a = await publicar(ana, `Mucha ANSIEDÁD hoy ${marca}`, { topic: 'ansiedad' });
  const b = await publicar(ana, `otro tema ${marca}`, { topic: 'estudios' });

  const porTema = (await call('GET', '/posts?topic=ansiedad&limit=50', beto.token)).body.posts;
  assert.ok(porTema.every((p) => p.topic === 'ansiedad'));
  assert.ok(porTema.some((p) => p.id === a.post.id));

  const busqueda = (await call('GET', `/posts?q=${encodeURIComponent(`ansiedad hoy ${marca}`)}`, beto.token)).body.posts;
  assert.deepEqual(busqueda.map((p) => p.id), [a.post.id]);

  const p1 = (await call('GET', `/posts?q=${marca}&limit=1`, beto.token)).body;
  assert.equal(p1.posts.length, 1);
  assert.equal(p1.posts[0].id, b.post.id, 'lo más reciente primero');
  assert.ok(p1.next_before);
  const p2 = (await call('GET', `/posts?q=${marca}&limit=1&before=${encodeURIComponent(p1.next_before)}`, beto.token)).body;
  assert.equal(p2.posts[0].id, a.post.id);

  assert.equal((await call('GET', '/posts?topic=otro', beto.token)).body.error, 'tema_invalido');
});

test('feed popular ordena por reacciones y comentarios, y pagina por offset', async () => {
  const marca = uid();
  const poco = await publicar(ana, `poco popular ${marca}`);
  const mucho = await publicar(ana, `muy popular ${marca}`);
  // Se crea después pero tiene más reacciones: debe ir primero igual.
  await call('POST', `/posts/${poco.post.id}/react`, beto.token);
  for (const who of [beto, dani, caro]) await call('POST', `/posts/${mucho.post.id}/react`, who.token);

  const r = (await call('GET', `/posts?sort=popular&q=${marca}&limit=1`, beto.token)).body;
  assert.equal(r.posts[0].id, mucho.post.id);
  assert.equal(r.next_before, null);
  assert.equal(r.next_offset, 1);
  const r2 = (await call('GET', `/posts?sort=popular&q=${marca}&limit=1&offset=1`, beto.token)).body;
  assert.equal(r2.posts[0].id, poco.post.id);
});

test('feed=following: solo lo firmado de a quien sigo, nunca lo anónimo', async () => {
  const marca = uid();
  const firmado = await publicar(dani, `firmado por dani ${marca}`, { isAnonymous: false });
  const anonimo = await publicar(dani, `anónimo de dani ${marca}`);
  assert.equal((await call('POST', `/users/${dani.publicId}/follow`, caro.token)).status, 200);

  const feed = (await call('GET', '/posts?feed=following&limit=50', caro.token)).body.posts;
  assert.ok(feed.some((p) => p.id === firmado.post.id));
  assert.ok(!feed.some((p) => p.id === anonimo.post.id), 'lo anónimo no debe aparecer como "de alguien a quien sigo"');
  await call('DELETE', `/users/${dani.publicId}/follow`, caro.token);
});

test('el feed incluye lo mío en cualquier estado y /me/posts trae held_reason', async () => {
  const { post } = await publicar(caro, `retenido mío ${uid()}${EN_REVISION}`);
  const feed = (await call('GET', '/posts', caro.token)).body.posts;
  assert.ok(feed.some((p) => p.id === post.id));
  const mios = (await call('GET', '/me/posts', caro.token)).body.posts;
  assert.equal(mios.find((p) => p.id === post.id).held_reason, 'review');
});

// ── reportes ─────────────────────────────────────────────────────────────

test('con 3 reportes distintos la publicación se oculta y su autor recibe post_hidden', async () => {
  const { post } = await publicar(ana, `reportable ${uid()}`);
  for (const who of [beto, caro]) {
    await call('POST', `/posts/${post.id}/report`, who.token, { reason: 'spam' });
  }
  // Reportar dos veces lo mismo no suma al umbral.
  await call('POST', `/posts/${post.id}/report`, beto.token, { reason: 'spam' });
  assert.equal((await call('GET', `/posts/${post.id}`, dani.token)).status, 200, 'con 2 sigue visible');

  const tercero = await call('POST', `/posts/${post.id}/report`, dani.token, { reason: 'harassment', detail: 'feo' });
  assert.equal(tercero.status, 201);
  assert.equal((await call('GET', `/posts/${post.id}`, dani.token)).status, 404, 'con 3 se oculta');

  const propio = (await call('GET', `/posts/${post.id}`, ana.token)).body.post;
  assert.equal(propio.status, 'pending');
  assert.equal(propio.held_reason, 'reports');

  const notis = (await call('GET', '/notifications', ana.token)).body.notifications;
  const n = notis.find((x) => x.kind === 'post_hidden' && x.post_id === post.id);
  assert.ok(n, 'debe avisarle a la autora');
  assert.equal(n.actor, null);
});

test('reportar con una razón inválida o algo que no existe', async () => {
  const { post } = await publicar(ana, `otro reportable ${uid()}`);
  assert.equal((await call('POST', `/posts/${post.id}/report`, beto.token, { reason: 'aburrido' })).body.error, 'razon_invalida');
  assert.equal((await call('POST', `/posts/${crypto.randomUUID()}/report`, beto.token, { reason: 'spam' })).status, 404);
});

// ── comentarios ──────────────────────────────────────────────────────────

test('comentarios: filtro, respuestas de un nivel y forma del contrato', async () => {
  const { post } = await publicar(ana, `para comentar ${uid()}`);
  const c1 = await call('POST', `/posts/${post.id}/comments`, beto.token, { body: 'ánimo', isAnonymous: false });
  assert.equal(c1.status, 201);
  assert.deepEqual(c1.body.moderation, { outcome: 'published', reason: null });
  const comment = c1.body.comment;
  for (const k of ['id', 'post_id', 'parent_id', 'body', 'status', 'created_at', 'author', 'author_name', 'is_own', 'likes', 'liked_by_me', 'held_reason']) {
    assert.ok(k in comment, `falta ${k}`);
  }
  assert.equal(comment.author.public_id, beto.publicId);

  const respuesta = await call('POST', `/posts/${post.id}/comments`, ana.token, { body: 'gracias', parentId: comment.id });
  assert.equal(respuesta.status, 201);
  assert.equal(respuesta.body.comment.parent_id, comment.id);

  const nieta = await call('POST', `/posts/${post.id}/comments`, beto.token, { body: 'otra', parentId: respuesta.body.comment.id });
  assert.equal(nieta.status, 400);
  assert.equal(nieta.body.error, 'respuesta_invalida');

  const lista = (await call('GET', `/posts/${post.id}/comments`, dani.token)).body.comments;
  assert.deepEqual(lista.map((c) => c.id), [comment.id, respuesta.body.comment.id], 'orden cronológico');
  sinRastroDe(lista[1], ana, 'Ana Prueba');

  const crisis = await call('POST', `/posts/${post.id}/comments`, caro.token, { body: 'yo también quiero morirme' });
  assert.deepEqual(crisis.body.moderation, { outcome: 'held', reason: 'crisis' });
  assert.equal(crisis.body.comment.held_reason, 'crisis');
  assert.ok(!(await call('GET', `/posts/${post.id}/comments`, dani.token)).body.comments.some((c) => c.id === crisis.body.comment.id));
});

test('"me gusta" en comentarios, y 404 sobre lo que no se puede ver', async () => {
  const { post } = await publicar(ana, `likes ${uid()}`);
  const { comment } = (await call('POST', `/posts/${post.id}/comments`, beto.token, { body: 'lindo' })).body;
  assert.equal((await call('POST', `/posts/comments/${comment.id}/like`, ana.token)).status, 200);
  await call('POST', `/posts/comments/${comment.id}/like`, ana.token);
  let c = (await call('GET', `/posts/${post.id}/comments`, ana.token)).body.comments[0];
  assert.equal(c.likes, 1);
  assert.equal(c.liked_by_me, true);
  await call('DELETE', `/posts/comments/${comment.id}/like`, ana.token);
  c = (await call('GET', `/posts/${post.id}/comments`, ana.token)).body.comments[0];
  assert.equal(c.likes, 0);

  const retenido = (await call('POST', `/posts/${post.id}/comments`, beto.token, { body: `retenido${EN_REVISION}` })).body.comment;
  assert.equal((await call('POST', `/posts/comments/${retenido.id}/like`, ana.token)).status, 404);
});

test('comentarios: 3 reportes lo ocultan', async () => {
  const { post } = await publicar(ana, `comentario reportable ${uid()}`);
  const { comment } = (await call('POST', `/posts/${post.id}/comments`, beto.token, { body: 'algo' })).body;
  for (const who of [ana, caro, dani]) {
    assert.equal((await call('POST', `/posts/comments/${comment.id}/report`, who.token, { reason: 'other' })).status, 201);
  }
  assert.ok(!(await call('GET', `/posts/${post.id}/comments`, dani.token)).body.comments.some((c) => c.id === comment.id));
  const propio = (await call('GET', `/posts/${post.id}/comments`, beto.token)).body.comments.find((c) => c.id === comment.id);
  assert.equal(propio.held_reason, 'reports');
});

// ── personas y seguimientos ──────────────────────────────────────────────

test('perfil público: solo con nombre, y lo anónimo no cuenta', async () => {
  const antes = (await call('GET', `/users/${ana.publicId}`, beto.token)).body.user;
  for (const k of ['public_id', 'display_name', 'avatar_emoji', 'avatar_color', 'bio', 'member_since', 'post_count', 'followers', 'following', 'followed_by_me', 'is_me']) {
    assert.ok(k in antes, `falta ${k}`);
  }
  assert.equal(antes.is_me, false);
  assert.ok(!('id' in antes) && !('role' in antes), 'nada privado');

  await publicar(ana, `anónimo que no cuenta ${uid()}`);
  const despues = (await call('GET', `/users/${ana.publicId}`, beto.token)).body.user;
  assert.equal(despues.post_count, antes.post_count);

  const firmado = await publicar(ana, `firmado que sí cuenta ${uid()}`, { isAnonymous: false });
  assert.equal((await call('GET', `/users/${ana.publicId}`, beto.token)).body.user.post_count, antes.post_count + 1);

  const posts = (await call('GET', `/users/${ana.publicId}/posts`, beto.token)).body;
  assert.ok('next_before' in posts);
  assert.ok(posts.posts.some((p) => p.id === firmado.post.id));
  assert.ok(posts.posts.every((p) => p.author?.public_id === ana.publicId), 'nunca algo anónimo');

  assert.equal((await call('GET', `/users/${caro.publicId}`, beto.token)).status, 404, 'sin nombre, sin perfil');
  assert.equal((await call('GET', '/users/NoExiste!', beto.token)).status, 404);
  assert.equal((await call('GET', `/users/${ana.publicId}`, ana.token)).body.user.is_me, true);
});

test('seguir y dejar de seguir; seguirse a sí mismo no', async () => {
  const antes = (await call('GET', `/users/${dani.publicId}`, beto.token)).body.user.followers;
  assert.equal((await call('POST', `/users/${dani.publicId}/follow`, beto.token)).status, 200);
  assert.equal((await call('POST', `/users/${dani.publicId}/follow`, beto.token)).status, 200, 'idempotente');
  const perfil = (await call('GET', `/users/${dani.publicId}`, beto.token)).body.user;
  assert.equal(perfil.followers, antes + 1);
  assert.equal(perfil.followed_by_me, true);

  const yo = await call('POST', `/users/${beto.publicId}/follow`, beto.token);
  assert.equal(yo.status, 400);
  assert.equal(yo.body.error, 'accion_invalida');

  await call('DELETE', `/users/${dani.publicId}/follow`, beto.token);
  assert.equal((await call('GET', `/users/${dani.publicId}`, beto.token)).body.user.followed_by_me, false);
});

// ── bloqueos ─────────────────────────────────────────────────────────────

test('bloquear desde un perfil oculta lo firmado en ambos sentidos y deshace el seguimiento', async () => {
  const eva = await cuenta('v2-eva@upb.edu.co', { name: 'Eva Prueba' });
  const fede = await cuenta('v2-fede@upb.edu.co', { name: 'Fede Prueba' });
  await call('POST', `/users/${fede.publicId}/follow`, eva.token);
  await call('POST', `/users/${eva.publicId}/follow`, fede.token);
  const deFede = await publicar(fede, `firmado de fede ${uid()}`, { isAnonymous: false });
  const deEva = await publicar(eva, `firmado de eva ${uid()}`, { isAnonymous: false });

  const b = await call('POST', `/users/${fede.publicId}/block`, eva.token);
  assert.equal(b.status, 200);
  assert.equal(b.body.block.label, 'Fede Prueba');

  assert.equal((await call('GET', `/posts/${deFede.post.id}`, eva.token)).status, 404);
  assert.equal((await call('GET', `/posts/${deEva.post.id}`, fede.token)).status, 404, 'en ambos sentidos');
  assert.equal((await call('GET', `/users/${fede.publicId}`, eva.token)).status, 404);
  assert.equal((await call('GET', `/users/${eva.publicId}`, fede.token)).status, 404);
  const { rows } = await owner.query(
    'select count(*)::int as n from public.follows where follower_id in ($1, $2) and followee_id in ($1, $2)',
    [eva.id, fede.id]
  );
  assert.equal(rows[0].n, 0, 'deshace el seguimiento entre ambas');
  assert.equal((await call('POST', `/users/${fede.publicId}/follow`, eva.token)).status, 404);

  const lista = (await call('GET', '/me/blocks', eva.token)).body.blocks;
  assert.deepEqual(Object.keys(lista[0]).sort(), ['created_at', 'id', 'label']);
  assert.equal((await call('DELETE', `/me/blocks/${lista[0].id}`, eva.token)).status, 200);
  assert.equal((await call('GET', `/posts/${deFede.post.id}`, eva.token)).status, 200, 'desbloquear lo devuelve');
});

test('bloquear al autor de algo anónimo no revela quién es', async () => {
  const gabi = await cuenta('v2-gabi@upb.edu.co', { name: 'Gabi Prueba' });
  const hugo = await cuenta('v2-hugo@upb.edu.co', { name: 'Hugo Prueba' });
  await call('POST', `/users/${gabi.publicId}/follow`, hugo.token);
  const firmado = await publicar(gabi, `gabi con nombre ${uid()}`, { isAnonymous: false });
  const anonimo = await publicar(gabi, `gabi en secreto ${uid()}`);
  const otroAnonimo = await publicar(gabi, `gabi en secreto otra vez ${uid()}`);

  const b = await call('POST', `/posts/${anonimo.post.id}/block-author`, hugo.token);
  assert.equal(b.status, 200);
  sinRastroDe(b.body, gabi, 'Gabi Prueba');
  assert.match(b.body.block.label, /gabi en secreto/, 'la etiqueta es un extracto, no el alias');

  // Lo firmado sigue visible y el seguimiento sigue en pie: si desaparecieran,
  // Hugo sabría que lo anónimo era de Gabi.
  assert.equal((await call('GET', `/posts/${firmado.post.id}`, hugo.token)).status, 200);
  assert.equal((await call('GET', `/users/${gabi.publicId}`, hugo.token)).body.user.followed_by_me, true);
  // Lo anónimo de esa persona se oculta.
  assert.equal((await call('GET', `/posts/${anonimo.post.id}`, hugo.token)).status, 404);
  assert.equal((await call('GET', `/posts/${otroAnonimo.post.id}`, hugo.token)).status, 404);

  const lista = (await call('GET', '/me/blocks', hugo.token)).body;
  sinRastroDe(lista, gabi, 'Gabi Prueba');

  // Bloquear dos veces lo mismo no duplica.
  await call('POST', `/posts/${anonimo.post.id}/block-author`, hugo.token);
  assert.equal((await call('GET', '/me/blocks', hugo.token)).body.blocks.length, 1);

  // No se bloquea uno a sí mismo.
  assert.equal((await call('POST', `/posts/${anonimo.post.id}/block-author`, gabi.token)).body.error, 'accion_invalida');
});

test('bloquear desde un comentario anónimo tampoco revela nada', async () => {
  const { post } = await publicar(ana, `post con comentario anónimo ${uid()}`);
  const { comment } = (await call('POST', `/posts/${post.id}/comments`, dani.token, { body: 'comentario anónimo de dani' })).body;
  sinRastroDe(comment, dani, 'Dani Prueba');
  const b = await call('POST', `/posts/comments/${comment.id}/block-author`, ana.token);
  assert.equal(b.status, 200);
  sinRastroDe(b.body, dani, 'Dani Prueba');
  assert.ok(!(await call('GET', `/posts/${post.id}/comments`, ana.token)).body.comments.some((c) => c.id === comment.id));
  await call('DELETE', `/me/blocks/${b.body.block.id}`, ana.token);
});

// ── notificaciones ───────────────────────────────────────────────────────

test('notificaciones: reacción con actor, comentario anónimo sin actor, nunca de uno mismo', async () => {
  const ines = await cuenta('v2-ines@upb.edu.co', { name: 'Ines Prueba' });
  const juan = await cuenta('v2-juan@upb.edu.co', { name: 'Juan Prueba' });
  const { post } = await publicar(ines, `notifícame ${uid()}`);

  await call('POST', `/posts/${post.id}/react`, juan.token, { kind: 'te_entiendo' });
  await call('POST', `/posts/${post.id}/react`, ines.token); // propia: no notifica
  await call('POST', `/posts/${post.id}/comments`, juan.token, { body: 'te leo, en anónimo' });
  await call('POST', `/users/${ines.publicId}/follow`, juan.token);

  const r = (await call('GET', '/notifications', ines.token)).body;
  assert.equal(r.unread, 3);
  assert.ok('next_before' in r);
  const reaccion = r.notifications.find((n) => n.kind === 'post_reaction');
  for (const k of ['id', 'kind', 'post_id', 'comment_id', 'reaction_kind', 'actor', 'excerpt', 'created_at', 'read']) {
    assert.ok(k in reaccion, `falta ${k}`);
  }
  assert.equal(reaccion.reaction_kind, 'te_entiendo');
  assert.equal(reaccion.actor.public_id, juan.publicId);
  assert.equal(reaccion.read, false);

  const comentario = r.notifications.find((n) => n.kind === 'post_comment');
  assert.equal(comentario.actor, null, 'comentó anónimo: sin actor');
  sinRastroDe(comentario, juan, 'Juan Prueba');
  assert.ok(r.notifications.find((n) => n.kind === 'new_follower').actor);

  assert.equal((await call('GET', '/notifications', juan.token)).body.unread, 0, 'nada de sus propias acciones');

  await call('POST', '/notifications/read', ines.token, { ids: [reaccion.id] });
  assert.equal((await call('GET', '/notifications/unread-count', ines.token)).body.unread, 2);
  await call('POST', '/notifications/read', ines.token, {});
  assert.equal((await call('GET', '/notifications/unread-count', ines.token)).body.unread, 0);
  assert.equal((await call('POST', '/notifications/read', ines.token, { ids: ['x'] })).status, 400);
});

test('respuestas notifican a quien escribió el comentario de arriba', async () => {
  const { post } = await publicar(ana, `hilo ${uid()}`);
  const c1 = await call('POST', `/posts/${post.id}/comments`, beto.token, { body: 'primer nivel' });
  assert.equal(c1.status, 201, JSON.stringify(c1.body));
  const { comment } = c1.body;
  await call('POST', `/notifications/read`, beto.token, {});
  await call('POST', `/posts/${post.id}/comments`, dani.token, { body: 'respuesta', parentId: comment.id, isAnonymous: false });
  const n = (await call('GET', '/notifications', beto.token)).body.notifications.find((x) => x.kind === 'comment_reply');
  assert.ok(n);
  assert.equal(n.actor.public_id, dani.publicId);
});

test('nadie lee las notificaciones de otra persona', async () => {
  const ajena = (await owner.query(
    'select id from public.notifications where recipient_id = $1 limit 1', [ana.id]
  )).rows[0];
  assert.ok(ajena);
  const r = (await call('GET', '/notifications', beto.token)).body.notifications;
  assert.ok(!r.some((n) => n.id === ajena.id));
  await call('POST', '/notifications/read', beto.token, { ids: [ajena.id] });
  const { rows } = await owner.query('select read_at from public.notifications where id = $1', [ajena.id]);
  assert.equal(rows[0].read_at, null, 'marcar como leída una ajena no hace nada');
});

test('las rutas nuevas exigen sesión', async () => {
  for (const path of ['/users/abcdefghij', '/me/blocks', '/notifications', '/entries', '/journal', '/challenges', '/me/saved']) {
    assert.equal((await api(path)).status, 401, path);
  }
});
