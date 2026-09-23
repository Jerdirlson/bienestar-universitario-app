// Pruebas de la capa de datos de la red social (src/data/socialCore.js y
// socialFormat.js) con un fetch simulado: rutas y query strings, normalización
// v1/v2, degradación con servidor v1, anonimato y errores.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSocialApi, ApiError, buildQuery, feedPath, errorMessageKey,
  normalizePost, normalizeComment, normalizeModeration, normalizeNotification,
  applyReaction, applyCommentLike, threadComments, validateProfileDraft, foldText,
  mergePage, replaceInList, TOPICS, AVATAR_COLORS, REPORT_REASONS,
} from '../src/data/socialCore.js';
import { relativeParts, groupByDay } from '../src/data/socialFormat.js';
import { SOCIAL_COPY } from '../src/i18n/social.js';

const BASE = 'https://api.test';

/**
 * fetch simulado: `routes` mapea "MÉTODO /ruta?query" (o solo la ruta, para
 * cualquier método) a { status, body } o a una función (req) => { status, body }.
 * Lo no mapeado responde 404 { error: 'not_found' }, como el servidor real.
 */
function mockFetch(routes = {}) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    const path = url.slice(BASE.length);
    const method = opts.method ?? 'GET';
    const req = { url, path, method, headers: opts.headers ?? {}, body: opts.body ? JSON.parse(opts.body) : undefined };
    calls.push(req);
    let r = routes[`${method} ${path}`] ?? routes[path];
    if (typeof r === 'function') r = r(req);
    if (r === 'offline') throw new TypeError('Network request failed');
    const { status = 200, body = {} } = r ?? { status: 404, body: { error: 'not_found' } };
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => (body === null ? Promise.reject(new SyntaxError('no json')) : body),
    };
  };
  return { fetchImpl, calls };
}

const v2Post = (over = {}) => ({
  id: 'p1', body: 'Hola', mood: 3, topic: 'estudios', status: 'published',
  created_at: '2026-09-20T10:00:00Z', edited_at: null,
  author: { public_id: 'u_abc', display_name: 'Luna', avatar_emoji: '🌙', avatar_color: 'sky' },
  author_name: 'Luna', is_own: false, reactions: 3,
  reaction_counts: { abrazo: 1, fuerza: 2, te_entiendo: 0, inspira: 0 },
  my_reaction: 'fuerza', reacted_by_me: true, comment_count: 4, saved_by_me: true, held_reason: null,
  ...over,
});

const v1Post = (over = {}) => ({
  id: 'p9', body: 'Canción de ánimo', mood: 2, status: 'published', created_at: '2026-09-20T10:00:00Z',
  author_name: null, is_own: false, reactions: 5, reacted_by_me: true, comment_count: 1,
  ...over,
});

// ── query strings y rutas ────────────────────────────────────────────────

test('buildQuery omite vacíos y codifica valores', () => {
  assert.equal(buildQuery({}), '');
  assert.equal(buildQuery({ a: undefined, b: null, c: '' }), '');
  assert.equal(buildQuery({ q: 'ansiedad y tú', n: 0 }), '?q=ansiedad%20y%20t%C3%BA&n=0');
});

test('feedPath: recent pagina por before, popular por offset', () => {
  assert.equal(feedPath({}), '/posts?feed=all&sort=recent');
  assert.equal(
    feedPath({ feed: 'following', topic: 'logros', q: '  examen ', before: '2026-09-01T00:00:00Z', limit: 20 }),
    '/posts?feed=following&topic=logros&sort=recent&q=examen&before=2026-09-01T00%3A00%3A00Z&limit=20',
  );
  assert.equal(feedPath({ sort: 'popular', before: 'x', offset: 40 }), '/posts?feed=all&sort=popular&offset=40');
  assert.equal(feedPath({ sort: 'popular', offset: 0 }), '/posts?feed=all&sort=popular');
});

// ── normalización ────────────────────────────────────────────────────────

test('normalizePost v2 conserva autor, reacciones por tipo y guardado', () => {
  const p = normalizePost(v2Post());
  assert.equal(p.author.publicId, 'u_abc');
  assert.equal(p.author.avatarColor, 'sky');
  assert.deepEqual(p.reactionCounts, { abrazo: 1, fuerza: 2, te_entiendo: 0, inspira: 0 });
  assert.equal(p.reactionTotal, 3);
  assert.equal(p.myReaction, 'fuerza');
  assert.equal(p.savedByMe, true);
  assert.equal(p.topic, 'estudios');
  assert.equal(p.heldReason, null);
});

test('anonimato: un post anónimo v2 no conserva nada del autor', () => {
  const p = normalizePost(v2Post({ author: null, author_name: null }));
  assert.equal(p.author, null);
  const json = JSON.stringify(p);
  assert.ok(!json.includes('u_abc') && !json.includes('Luna'), 'quedó un rastro del autor');
});

test('normalizePost v1: reacciones como abrazo, autor sin public_id, sin tema', () => {
  const anon = normalizePost(v1Post());
  assert.equal(anon.author, null);
  assert.equal(anon.reactionCounts.abrazo, 5);
  assert.equal(anon.myReaction, 'abrazo');
  assert.equal(anon.topic, null);
  assert.equal(anon.savedByMe, false);
  const named = normalizePost(v1Post({ author_name: 'Sol' }));
  assert.deepEqual(named.author, { publicId: null, displayName: 'Sol', avatarEmoji: null, avatarColor: null });
});

test('held_reason solo aparece en lo propio pendiente; v1 pendiente propio = review', () => {
  assert.equal(normalizePost(v2Post({ is_own: true, status: 'pending', held_reason: 'crisis' })).heldReason, 'crisis');
  assert.equal(normalizePost(v2Post({ is_own: false, status: 'pending', held_reason: 'crisis' })).heldReason, null);
  assert.equal(normalizePost(v1Post({ is_own: true, status: 'pending' })).heldReason, 'review');
  assert.equal(normalizePost(v1Post({ is_own: true, status: 'published' })).heldReason, null);
});

test('normalizeModeration: v2 explícito, v1 deducido del estado', () => {
  assert.deepEqual(normalizeModeration({ moderation: { outcome: 'held', reason: 'crisis' } }), { outcome: 'held', reason: 'crisis' });
  assert.deepEqual(normalizeModeration({ moderation: { outcome: 'published', reason: null } }), { outcome: 'published', reason: null });
  assert.deepEqual(normalizeModeration({}, { status: 'pending' }), { outcome: 'held', reason: 'review' });
  assert.deepEqual(normalizeModeration({}, { status: 'published' }), { outcome: 'published', reason: null });
});

test('normalizeComment y normalizeNotification', () => {
  const c = normalizeComment({ id: 'c1', post_id: 'p1', parent_id: 'c0', body: 'x', status: 'published', created_at: 'z', author: null, author_name: null, is_own: false, likes: 2, liked_by_me: true });
  assert.equal(c.parentId, 'c0');
  assert.equal(c.author, null);
  assert.equal(c.likes, 2);
  const v1c = normalizeComment({ id: 'c2', body: 'y', status: 'published', created_at: 'z', author_name: null, is_own: true });
  assert.equal(v1c.likes, 0);
  assert.equal(v1c.parentId, null);
  const n = normalizeNotification({ id: 'n1', kind: 'post_reaction', post_id: 'p1', comment_id: null, reaction_kind: 'inspira', actor: null, excerpt: 'Hola', created_at: 'z', read: false });
  assert.equal(n.actor, null);
  assert.equal(n.reactionKind, 'inspira');
});

// ── lógica sin estado ────────────────────────────────────────────────────

test('applyReaction cambia de tipo, agrega y quita sin conteos negativos', () => {
  const p = normalizePost(v2Post());
  const changed = applyReaction(p, 'inspira');
  assert.deepEqual(changed.reactionCounts, { abrazo: 1, fuerza: 1, te_entiendo: 0, inspira: 1 });
  assert.equal(changed.reactionTotal, 3);
  const removed = applyReaction(changed, null);
  assert.equal(removed.reactionTotal, 2);
  assert.equal(removed.myReaction, null);
  const zero = normalizePost(v2Post({ reaction_counts: { abrazo: 0, fuerza: 0, te_entiendo: 0, inspira: 0 }, my_reaction: 'abrazo' }));
  assert.equal(applyReaction(zero, null).reactionCounts.abrazo, 0);
});

test('applyCommentLike es idempotente', () => {
  const c = { likes: 1, likedByMe: false };
  assert.deepEqual(applyCommentLike(c, true), { likes: 2, likedByMe: true });
  assert.equal(applyCommentLike(c, false), c);
});

test('threadComments: respuestas de un nivel y huérfanas a primer nivel', () => {
  const list = [
    { id: 'a', parentId: null, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', parentId: 'a', createdAt: '2026-01-01T00:02:00Z' },
    { id: 'c', parentId: null, createdAt: '2026-01-01T00:01:00Z' },
    { id: 'd', parentId: 'zz', createdAt: '2026-01-01T00:03:00Z' },
  ];
  const t = threadComments(list);
  assert.deepEqual(t.map(x => x.id), ['a', 'c', 'd']);
  assert.deepEqual(t[0].replies.map(x => x.id), ['b']);
});

test('validateProfileDraft refleja las reglas de PATCH /auth/profile', () => {
  assert.equal(validateProfileDraft({ displayName: 'A' }), 'nombre_invalido');
  assert.equal(validateProfileDraft({ displayName: 'x'.repeat(41) }), 'nombre_invalido');
  assert.equal(validateProfileDraft({ displayName: '  Ana  ' }), null);
  assert.equal(validateProfileDraft({ bio: 'x'.repeat(161) }), 'bio_invalida');
  assert.equal(validateProfileDraft({ avatarColor: 'verde' }), 'avatar_invalido');
  assert.equal(validateProfileDraft({ avatarEmoji: '' }), 'avatar_invalido');
  assert.equal(validateProfileDraft({ avatarEmoji: '🌱', avatarColor: 'mint', bio: '' }), null);
  assert.deepEqual(AVATAR_COLORS, ['lilac', 'mint', 'sun', 'peach', 'sky', 'rose']);
});

test('foldText, mergePage y replaceInList', () => {
  assert.equal(foldText('Ánimo CANCIÓN'), 'animo cancion');
  assert.deepEqual(mergePage([{ id: 1 }], [{ id: 1 }, { id: 2 }]).map(x => x.id), [1, 2]);
  assert.deepEqual(replaceInList([{ id: 1 }, { id: 2 }], 1, null), [{ id: 2 }]);
  assert.deepEqual(replaceInList([{ id: 1, v: 0 }], 1, { id: 1, v: 1 }), [{ id: 1, v: 1 }]);
});

test('errorMessageKey traduce códigos y nunca devuelve el código crudo', () => {
  assert.equal(errorMessageKey(new ApiError('sin_conexion')), 'socErrOffline');
  assert.equal(errorMessageKey(new ApiError('demasiadas_publicaciones', 429)), 'socErrTooManyPosts');
  assert.equal(errorMessageKey(new ApiError('falta_nombre', 400)), 'socErrNeedAlias');
  assert.equal(errorMessageKey(new ApiError('algo_raro', 500)), 'socErrGeneric');
  assert.equal(errorMessageKey(new Error('x')), 'socErrGeneric');
  for (const code of ['sin_conexion', 'demasiadas_publicaciones', 'demasiados_comentarios', 'falta_nombre', 'texto_invalido',
    'nombre_invalido', 'bio_invalida', 'avatar_invalido', 'not_found', 'no_disponible', 'sesion_invalida', 'tiene_historial_de_moderacion', 'x']) {
    const key = errorMessageKey(new ApiError(code));
    assert.ok(SOCIAL_COPY.es[key] && SOCIAL_COPY.en[key], `falta el texto ${key}`);
  }
});

test('cada tema, motivo de reporte y color tiene texto en ambos idiomas', () => {
  for (const lang of ['es', 'en']) {
    const c = SOCIAL_COPY[lang];
    for (const k of TOPICS) assert.ok(c.socTopics[k], `${lang} tema ${k}`);
    for (const k of REPORT_REASONS) assert.ok(c.socReportReasons[k], `${lang} motivo ${k}`);
  }
});

// ── cliente contra fetch simulado (v2) ───────────────────────────────────

test('getMeta: 200 → v2, 404 → v1, sin conexión → null sin cambiar la versión', async () => {
  let api = createSocialApi({ baseUrl: BASE, fetchImpl: mockFetch({ '/meta': { body: { api_version: 2 } } }).fetchImpl });
  assert.equal(await api.getMeta(), 2);
  assert.equal(api.apiVersion, 2);
  const m = mockFetch({});
  api = createSocialApi({ baseUrl: BASE, fetchImpl: m.fetchImpl });
  assert.equal(await api.getMeta(), 1);
  assert.equal(m.calls[0].headers.authorization, undefined, '/meta no debe mandar el token');
  api = createSocialApi({ baseUrl: BASE, fetchImpl: mockFetch({ '/meta': 'offline' }).fetchImpl });
  assert.equal(await api.getMeta(), null);
  assert.equal(api.apiVersion, null);
});

test('listPosts v2: manda filtros, token y devuelve cursor', async () => {
  const m = mockFetch({
    'GET /posts?feed=following&topic=ansiedad&sort=recent&q=hola&limit=20': { body: { posts: [v2Post()], next_before: '2026-09-19T00:00:00Z' } },
  });
  const api = createSocialApi({ baseUrl: BASE, fetchImpl: m.fetchImpl });
  api.setApiVersion(2);
  const r = await api.listPosts('tok', { feed: 'following', topic: 'ansiedad', q: 'hola' });
  assert.equal(r.posts[0].id, 'p1');
  assert.equal(r.next, '2026-09-19T00:00:00Z');
  assert.equal(m.calls[0].headers.authorization, 'Bearer tok');
});

test('listPosts popular: el siguiente cursor es un offset', async () => {
  const page = Array.from({ length: 2 }, (_, i) => v2Post({ id: `p${i}` }));
  const m = mockFetch({ 'GET /posts?feed=all&sort=popular&offset=2&limit=2': { body: { posts: page, next_before: null } } });
  const api = createSocialApi({ baseUrl: BASE, fetchImpl: m.fetchImpl });
  api.setApiVersion(2);
  const r = await api.listPosts('t', { sort: 'popular', offset: 2, limit: 2 });
  assert.equal(r.next, 4);
});

test('createPost: devuelve moderación crisis y manda tema', async () => {
  const m = mockFetch({
    'POST /posts': (req) => ({
      status: 201,
      body: { post: v2Post({ is_own: true, status: 'pending', held_reason: 'crisis', topic: req.body.topic }), moderation: { outcome: 'held', reason: 'crisis' } },
    }),
  });
  const api = createSocialApi({ baseUrl: BASE, fetchImpl: m.fetchImpl });
  api.setApiVersion(2);
  const r = await api.createPost('t', { body: 'x', mood: 1, topic: 'desahogo', isAnonymous: true });
  assert.deepEqual(r.moderation, { outcome: 'held', reason: 'crisis' });
  assert.deepEqual(m.calls[0].body, { body: 'x', isAnonymous: true, mood: 1, topic: 'desahogo' });
  assert.equal(r.post.heldReason, 'crisis');
});

test('errores del servidor llegan como ApiError con código y status', async () => {
  const api = createSocialApi({
    baseUrl: BASE,
    fetchImpl: mockFetch({ 'POST /posts': { status: 429, body: { error: 'demasiadas_publicaciones' } } }).fetchImpl,
  });
  await assert.rejects(api.createPost('t', { body: 'x' }), (e) => e instanceof ApiError && e.code === 'demasiadas_publicaciones' && e.status === 429);
  const off = createSocialApi({ baseUrl: BASE, fetchImpl: mockFetch({ '/posts?feed=all&sort=recent&limit=20': 'offline' }).fetchImpl });
  await assert.rejects(off.listPosts('t'), (e) => e.code === 'sin_conexion');
  const noUrl = createSocialApi({ baseUrl: null, fetchImpl: () => { throw new Error('no debería llamar'); } });
  await assert.rejects(noUrl.listPosts('t'), (e) => e.code === 'sin_configurar');
  const html = createSocialApi({ baseUrl: BASE, fetchImpl: mockFetch({ '/posts/p1': { status: 500, body: null } }).fetchImpl });
  html.setApiVersion(2);
  await assert.rejects(html.getPost('t', 'p1'), (e) => e.code === 'error_desconocido' && e.status === 500);
});

test('rutas de acciones: reacción con tipo, guardar, reportar, bloquear, seguir, comentarios', async () => {
  const m = mockFetch({
    'POST /posts/p1/react': { body: { ok: true } },
    'DELETE /posts/p1/react': { body: { ok: true } },
    'POST /posts/p1/save': { body: { ok: true } },
    'POST /posts/p1/report': { status: 201, body: { ok: true } },
    'POST /posts/p1/block-author': { body: { ok: true } },
    'POST /posts/comments/c1/like': { body: { ok: true } },
    'POST /posts/comments/c1/block-author': { body: { ok: true } },
    'POST /users/u%2Fx/follow': { body: { ok: true } },
    'DELETE /me/blocks/b1': { body: { ok: true } },
    'POST /posts/p1/comments': { status: 201, body: { comment: { id: 'c9', post_id: 'p1', parent_id: 'c1', body: 'y', status: 'published', created_at: 'z', author: null, author_name: null, is_own: true, likes: 0, liked_by_me: false }, moderation: { outcome: 'published', reason: null } } },
  });
  const api = createSocialApi({ baseUrl: BASE, fetchImpl: m.fetchImpl });
  api.setApiVersion(2);
  await api.react('t', 'p1', 'te_entiendo');
  await api.unreact('t', 'p1');
  await api.savePost('t', 'p1');
  await api.reportPost('t', 'p1', 'spam', '  detalle  ');
  await api.blockPostAuthor('t', 'p1');
  await api.likeComment('t', 'c1');
  await api.blockCommentAuthor('t', 'c1');
  await api.follow('t', 'u/x');
  await api.unblock('t', 'b1');
  const r = await api.createComment('t', 'p1', { body: 'y', parentId: 'c1', isAnonymous: true });
  assert.equal(r.moderation.outcome, 'published');
  assert.deepEqual(m.calls[0].body, { kind: 'te_entiendo' });
  assert.deepEqual(m.calls[3].body, { reason: 'spam', detail: 'detalle' });
  assert.deepEqual(m.calls.at(-1).body, { body: 'y', isAnonymous: true, parentId: 'c1' });
  assert.ok(m.calls.every(c => c.headers.authorization === 'Bearer t'));
});

test('updateProfile v2 manda solo lo cambiado; deleteAccount usa DELETE /auth/account', async () => {
  const m = mockFetch({
    'PATCH /auth/profile': { body: { ok: true } },
    'DELETE /auth/account': { body: { ok: true } },
    'GET /auth/me': { body: { id: 'i', email: 'a@upb.edu.co', display_name: 'Ana', public_id: 'u1', avatar_emoji: '🌱', avatar_color: 'mint', bio: 'hola' } },
  });
  const api = createSocialApi({ baseUrl: BASE, fetchImpl: m.fetchImpl });
  api.setApiVersion(2);
  await api.updateProfile('t', { bio: 'nueva', avatarColor: 'sun', displayName: undefined });
  assert.deepEqual(m.calls[0].body, { bio: 'nueva', avatarColor: 'sun' });
  await api.deleteAccount('t');
  assert.equal(m.calls[1].method, 'DELETE');
  const me = await api.getMe('t');
  assert.equal(me.publicId, 'u1');
  assert.equal(me.avatarEmoji, '🌱');
});

test('notificaciones v2: lista, conteo y marcar leídas', async () => {
  const m = mockFetch({
    'GET /notifications?before=x': { body: { notifications: [{ id: 'n1', kind: 'new_follower', actor: { public_id: 'u2', display_name: 'Leo' }, created_at: 'z', read: false }], unread: 3, next_before: null } },
    'GET /notifications/unread-count': { body: { unread: 7 } },
    'POST /notifications/read': { body: { ok: true } },
  });
  const api = createSocialApi({ baseUrl: BASE, fetchImpl: m.fetchImpl });
  api.setApiVersion(2);
  const r = await api.listNotifications('t', { before: 'x' });
  assert.equal(r.unread, 3);
  assert.equal(r.notifications[0].actor.publicId, 'u2');
  assert.equal(await api.unreadCount('t'), 7);
  await api.markRead('t', ['n1']);
  await api.markRead('t');
  assert.deepEqual(m.calls.at(-2).body, { ids: ['n1'] });
  assert.deepEqual(m.calls.at(-1).body, {});
});

// ── degradación con servidor v1 ──────────────────────────────────────────

function v1Server() {
  return mockFetch({
    'GET /posts': { body: { posts: [v1Post({ id: 'a', body: 'Canción de ánimo', reactions: 1 }), v1Post({ id: 'b', body: 'Otra cosa', is_own: true, status: 'pending', reactions: 9 })] } },
    'POST /posts': { status: 201, body: { post: { id: 'n', body: 'x', status: 'pending', created_at: 'z', author_name: null, is_own: true, reactions: 0, reacted_by_me: false, comment_count: 0 } } },
    'PATCH /auth/profile': { body: { ok: true } },
  });
}

test('v1: feed sin query, búsqueda y orden popular en el cliente, siguiendo vacío', async () => {
  const m = v1Server();
  const api = createSocialApi({ baseUrl: BASE, fetchImpl: m.fetchImpl });
  assert.equal(await api.getMeta(), 1);
  const r = await api.listPosts('t', { q: 'cancion', topic: 'logros' });
  assert.deepEqual(r.posts.map(p => p.id), ['a']);
  assert.equal(r.next, null);
  assert.equal(m.calls[1].path, '/posts');
  const pop = await api.listPosts('t', { sort: 'popular' });
  assert.deepEqual(pop.posts.map(p => p.id), ['b', 'a']);
  const following = await api.listPosts('t', { feed: 'following' });
  assert.deepEqual(following.posts, []);
});

test('v1: publicar no manda tema y el resultado es "en revisión"', async () => {
  const m = v1Server();
  const api = createSocialApi({ baseUrl: BASE, fetchImpl: m.fetchImpl });
  await api.getMeta();
  const r = await api.createPost('t', { body: 'x', topic: 'logros' });
  assert.deepEqual(r.moderation, { outcome: 'held', reason: 'review' });
  assert.equal(m.calls.at(-1).body.topic, undefined);
});

test('v1: lo que no existe se degrada sin lanzar', async () => {
  const m = v1Server();
  const api = createSocialApi({ baseUrl: BASE, fetchImpl: m.fetchImpl });
  await api.getMeta();
  assert.equal(await api.unreadCount('t'), 0);
  assert.deepEqual((await api.listNotifications('t')).notifications, []);
  assert.deepEqual((await api.listSaved('t')).posts, []);
  assert.deepEqual(await api.listBlocks('t'), []);
  await api.markRead('t');
  const mine = await api.listMyPosts('t');
  assert.deepEqual(mine.posts.map(p => p.id), ['b']);
  const byId = await api.getPost('t', 'a');
  assert.equal(byId.id, 'a');
  await assert.rejects(api.getPost('t', 'zzz'), (e) => e.code === 'not_found');
  await assert.rejects(api.updatePost('t', 'b', { body: 'x' }), (e) => e.code === 'no_disponible');
  await assert.rejects(api.deleteAccount('t'), (e) => e.code === 'no_disponible');
});

test('v1: updateProfile solo manda el alias y omite lo demás', async () => {
  const m = v1Server();
  const api = createSocialApi({ baseUrl: BASE, fetchImpl: m.fetchImpl });
  await api.getMeta();
  const skipped = await api.updateProfile('t', { bio: 'hola' });
  assert.equal(skipped.skipped, true);
  await api.updateProfile('t', { displayName: ' Ana ', bio: 'hola', avatarColor: 'sun' });
  assert.deepEqual(m.calls.at(-1).body, { displayName: 'Ana' });
});

test('versión desconocida: un 404 en rutas de lista v2 también se degrada', async () => {
  const api = createSocialApi({ baseUrl: BASE, fetchImpl: mockFetch({}).fetchImpl });
  assert.equal(await api.unreadCount('t'), 0);
  assert.deepEqual((await api.listSaved('t')).posts, []);
});

// ── formato ──────────────────────────────────────────────────────────────

test('relativeParts', () => {
  const now = Date.parse('2026-09-23T12:00:00Z');
  assert.deepEqual(relativeParts('2026-09-23T11:59:40Z', now), { unit: 'now', value: 0 });
  assert.deepEqual(relativeParts('2026-09-23T11:15:00Z', now), { unit: 'm', value: 45 });
  assert.deepEqual(relativeParts('2026-09-23T07:00:00Z', now), { unit: 'h', value: 5 });
  assert.deepEqual(relativeParts('2026-09-20T12:00:00Z', now), { unit: 'd', value: 3 });
  assert.equal(relativeParts('2026-08-01T12:00:00Z', now).unit, 'date');
  assert.equal(relativeParts('basura', now).unit, 'now');
  assert.equal(relativeParts('2026-09-24T12:00:00Z', now).unit, 'now', 'reloj adelantado no da negativos');
});

test('groupByDay: hoy, ayer y fechas', () => {
  const now = new Date(2026, 8, 23, 15, 0).getTime();
  const items = [
    { id: 1, createdAt: new Date(2026, 8, 23, 14, 0).toISOString() },
    { id: 2, createdAt: new Date(2026, 8, 23, 1, 0).toISOString() },
    { id: 3, createdAt: new Date(2026, 8, 22, 9, 0).toISOString() },
    { id: 4, createdAt: new Date(2026, 8, 10, 9, 0).toISOString() },
  ];
  const g = groupByDay(items, now);
  assert.deepEqual(g.map(s => s.key), ['today', 'yesterday', '2026-09-10']);
  assert.deepEqual(g[0].items.map(i => i.id), [1, 2]);
});
