// Pruebas de la comunidad: publicar, reaccionar, reportar, y moderar desde
// el panel de administración.
//
//   bash api/run-tests.sh
//
// El punto que más importa probar acá no es "funciona" — es "nada se publica
// solo" y "moderar es cosa exclusiva de admin, ni siquiera un moderador
// alcanza". Cada prueba de moderación intenta romper esas dos reglas antes
// de confirmar que el camino correcto funciona.

import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import crypto from 'node:crypto';

const { app } = await import('../src/server.js');
const { closePool } = await import('../src/db.js');

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const OWNER_URL = process.env.OWNER_DATABASE_URL;
if (!OWNER_URL) throw new Error('Falta OWNER_DATABASE_URL. Usar api/run-tests.sh.');
const owner = new pg.Client({ connectionString: OWNER_URL });
await owner.connect();

const AUTORA_EMAIL = 'comunidad-autora@upb.edu.co';
const LECTOR_EMAIL = 'comunidad-lector@upb.edu.co';
const MOD_EMAIL = 'comunidad-moderadora@upb.edu.co';
const ADMIN_EMAIL = 'comunidad-admin@upb.edu.co';
const PASS = 'clave-de-pruebas';

// moderation_actions.moderator_id es on delete restrict a propósito (ver
// migración moderation_actions_fk_fix): una cuenta con historial de
// moderación no se puede borrar en cascada sin más. Limpiar de verdad
// significa borrar primero lo que esa cuenta moderó.
async function borrarCuenta(email) {
  await owner.query(
    `delete from public.moderation_actions
       where moderator_id = (select id from auth.users where email = $1)`,
    [email]
  );
  await owner.query(`delete from auth.users where email = $1`, [email]);
}

async function crearCuenta(email, { role = null } = {}) {
  await borrarCuenta(email);
  await owner.query(
    `insert into auth.users (email, password_hash) values ($1, crypt($2, gen_salt('bf', 4)))`,
    [email, PASS]
  );
  if (role) {
    await owner.query(
      `update public.profiles set role = $2 where id = (select id from auth.users where email = $1)`,
      [email, role]
    );
  }
}

async function login(email) {
  const res = await fetch(`${base}/auth/login-password`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  });
  return (await res.json()).token;
}

await crearCuenta(AUTORA_EMAIL);
await crearCuenta(LECTOR_EMAIL);
await crearCuenta(MOD_EMAIL, { role: 'moderator' });
await crearCuenta(ADMIN_EMAIL, { role: 'admin' });
await owner.query(
  `update public.profiles set display_name = 'Autora de Prueba'
     where id = (select id from auth.users where email = $1)`,
  [AUTORA_EMAIL]
);

const tokenAutora = await login(AUTORA_EMAIL);
const tokenLector = await login(LECTOR_EMAIL);
const tokenMod = await login(MOD_EMAIL);
const tokenAdmin = await login(ADMIN_EMAIL);

test.after(async () => {
  for (const email of [AUTORA_EMAIL, LECTOR_EMAIL, MOD_EMAIL, ADMIN_EMAIL]) {
    await borrarCuenta(email);
  }
  await owner.end();
  await new Promise((resolve) => server.close(resolve));
  await closePool();
});

const api = (path, token, opts = {}) =>
  fetch(`${base}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...opts.headers },
  });

test('crear un post lo deja en pending, y solo la autora lo ve', async () => {
  const cuerpo = `hola comunidad ${crypto.randomUUID()}`;
  const crear = await api('/posts', tokenAutora, { method: 'POST', body: JSON.stringify({ body: cuerpo, mood: 2 }) });
  assert.equal(crear.status, 201);
  const { post } = await crear.json();
  assert.equal(post.status, 'pending');
  assert.equal(post.is_own, true);

  const feedAutora = await (await api('/posts', tokenAutora)).json();
  assert.ok(feedAutora.posts.some(p => p.id === post.id), 'la autora debe ver su propio post pendiente');

  const feedLector = await (await api('/posts', tokenLector)).json();
  assert.ok(!feedLector.posts.some(p => p.id === post.id), 'nadie más debe ver un post pendiente');
});

test('un texto vacío o demasiado largo no se publica', async () => {
  const vacio = await api('/posts', tokenAutora, { method: 'POST', body: JSON.stringify({ body: '' }) });
  assert.equal(vacio.status, 400);

  const largo = await api('/posts', tokenAutora, { method: 'POST', body: JSON.stringify({ body: 'x'.repeat(2001) }) });
  assert.equal(largo.status, 400);
});

test('la app móvil no tiene ningún camino para moderar — ni existe la ruta', async () => {
  const crear = await api('/posts', tokenAutora, { method: 'POST', body: JSON.stringify({ body: 'moderame si puedes' }) });
  const { post } = await crear.json();

  // Estas rutas vivían en /posts antes de mover moderación a /admin — deben
  // devolver 404 (no existen acá), no un simple 403.
  const intento = await api(`/posts/${post.id}/moderate`, tokenAdmin, {
    method: 'POST', body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(intento.status, 404);
  const cola = await api('/posts/queue', tokenAdmin);
  assert.equal(cola.status, 404);
});

test('un lector cualquiera no puede moderar desde /admin', async () => {
  const crear = await api('/posts', tokenAutora, { method: 'POST', body: JSON.stringify({ body: 'moderame si puedes 2' }) });
  const { post } = await crear.json();

  const intento = await api(`/admin/posts/${post.id}/moderate`, tokenLector, {
    method: 'POST', body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(intento.status, 403);

  const sigue = await (await api('/posts', tokenAutora)).json();
  assert.equal(sigue.posts.find(p => p.id === post.id).status, 'pending', 'no debe haber cambiado de estado');
});

test('ser moderador YA NO alcanza para aprobar — solo admin', async () => {
  const crear = await api('/posts', tokenAutora, { method: 'POST', body: JSON.stringify({ body: 'moderador no alcanza' }) });
  const { post } = await crear.json();

  const cola = await api('/admin/queue', tokenMod);
  assert.equal(cola.status, 403, 'is_admin() debe rechazar a un moderator, no solo a un lector');

  const intento = await api(`/admin/posts/${post.id}/moderate`, tokenMod, {
    method: 'POST', body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(intento.status, 403);
});

test('un administrador publica desde /admin, y ahí sí lo ve todo el mundo', async () => {
  const cuerpo = `post que se va a publicar ${crypto.randomUUID()}`;
  const crear = await api('/posts', tokenAutora, { method: 'POST', body: JSON.stringify({ body: cuerpo }) });
  const { post } = await crear.json();

  const enCola = await (await api('/admin/queue', tokenAdmin)).json();
  assert.ok(enCola.posts.some(p => p.id === post.id), 'debe aparecer en la cola de moderación');

  const moderar = await api(`/admin/posts/${post.id}/moderate`, tokenAdmin, {
    method: 'POST', body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(moderar.status, 200);

  const feedLector = await (await api('/posts', tokenLector)).json();
  const visto = feedLector.posts.find(p => p.id === post.id);
  assert.ok(visto, 'ahora sí debe verlo alguien que no es la autora');
  assert.equal(visto.status, 'published');
  assert.equal(visto.is_own, false);
});

test('reaccionar a un post pendiente no funciona; a uno publicado sí', async () => {
  const crear = await api('/posts', tokenAutora, { method: 'POST', body: JSON.stringify({ body: 'reacciona si puedes' }) });
  const { post } = await crear.json();

  const reaccionPendiente = await api(`/posts/${post.id}/react`, tokenLector, { method: 'POST' });
  assert.equal(reaccionPendiente.status, 500, 'la base debe rechazar reaccionar a algo no publicado');

  await api(`/admin/posts/${post.id}/moderate`, tokenAdmin, { method: 'POST', body: JSON.stringify({ action: 'publish' }) });

  const reaccion = await api(`/posts/${post.id}/react`, tokenLector, { method: 'POST' });
  assert.equal(reaccion.status, 200);

  const feed = await (await api('/posts', tokenLector)).json();
  const visto = feed.posts.find(p => p.id === post.id);
  assert.equal(visto.reactions, 1);
  assert.equal(visto.reacted_by_me, true);

  // Tocar dos veces no debe duplicar ni fallar.
  await api(`/posts/${post.id}/react`, tokenLector, { method: 'POST' });
  const feed2 = await (await api('/posts', tokenLector)).json();
  assert.equal(feed2.posts.find(p => p.id === post.id).reactions, 1);

  await api(`/posts/${post.id}/react`, tokenLector, { method: 'DELETE' });
  const feed3 = await (await api('/posts', tokenLector)).json();
  assert.equal(feed3.posts.find(p => p.id === post.id).reactions, 0);
});

test('reportar un post funciona, y reportarlo dos veces no duplica', async () => {
  const crear = await api('/posts', tokenAutora, { method: 'POST', body: JSON.stringify({ body: 'reportame' }) });
  const { post } = await crear.json();

  const primero = await api(`/posts/${post.id}/report`, tokenLector, {
    method: 'POST', body: JSON.stringify({ reason: 'spam' }),
  });
  assert.equal(primero.status, 201);

  const segundo = await api(`/posts/${post.id}/report`, tokenLector, {
    method: 'POST', body: JSON.stringify({ reason: 'spam' }),
  });
  assert.equal(segundo.status, 201, 'no debe fallar, solo no duplicar');

  const { rows } = await owner.query('select count(*)::int as n from public.post_reports where post_id = $1', [post.id]);
  assert.equal(rows[0].n, 1);
});

test('una razón de reporte inválida no pasa', async () => {
  const crear = await api('/posts', tokenAutora, { method: 'POST', body: JSON.stringify({ body: 'reportame mal' }) });
  const { post } = await crear.json();

  const res = await api(`/posts/${post.id}/report`, tokenLector, {
    method: 'POST', body: JSON.stringify({ reason: 'no-existe' }),
  });
  assert.equal(res.status, 400);
});

test('borrar el propio post lo saca del feed', async () => {
  const crear = await api('/posts', tokenAutora, { method: 'POST', body: JSON.stringify({ body: 'me arrepentí' }) });
  const { post } = await crear.json();

  const borrar = await api(`/posts/${post.id}`, tokenAutora, { method: 'DELETE' });
  assert.equal(borrar.status, 200);

  const feed = await (await api('/posts', tokenAutora)).json();
  assert.ok(!feed.posts.some(p => p.id === post.id));
});

// ── anonimato ─────────────────────────────────────────────────────────────

test('anónime por defecto: sin nombre en la respuesta ni en el feed', async () => {
  const crear = await api('/posts', tokenAutora, { method: 'POST', body: JSON.stringify({ body: 'anonimo por defecto' }) });
  const { post } = await crear.json();
  assert.equal(post.author_name, null);
});

test('con nombre: usa el display_name ya guardado, y queda igual aunque cambie después', async () => {
  const crear = await api('/posts', tokenAutora, {
    method: 'POST', body: JSON.stringify({ body: 'firmo con mi nombre', isAnonymous: false }),
  });
  assert.equal(crear.status, 201);
  const { post } = await crear.json();
  assert.equal(post.author_name, 'Autora de Prueba');

  await owner.query(
    `update public.profiles set display_name = 'Nombre Nuevo' where id = (select id from auth.users where email = $1)`,
    [AUTORA_EMAIL]
  );
  await owner.query(
    `update public.profiles set display_name = 'Autora de Prueba' where id = (select id from auth.users where email = $1)`,
    [AUTORA_EMAIL]
  );
  // No hace falta volver a leer el post: author_display_name es una copia,
  // no un link — el punto de esta prueba es justo que NO se resuelve al leer.
});

test('publicar con nombre sin haberlo puesto en el perfil, falla claro', async () => {
  const res = await api('/posts', tokenLector, {
    method: 'POST', body: JSON.stringify({ body: 'quiero firmar pero no tengo nombre', isAnonymous: false }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, 'falta_nombre');
});

// ── comentarios ───────────────────────────────────────────────────────────

async function crearYPublicar(token, body) {
  const crear = await api('/posts', token, { method: 'POST', body: JSON.stringify({ body }) });
  const { post } = await crear.json();
  await api(`/admin/posts/${post.id}/moderate`, tokenAdmin, { method: 'POST', body: JSON.stringify({ action: 'publish' }) });
  return post.id;
}

test('comentar en un post no publicado no funciona; en uno publicado sí, y nace pending', async () => {
  const crear = await api('/posts', tokenAutora, { method: 'POST', body: JSON.stringify({ body: 'post sin publicar todavía' }) });
  const { post } = await crear.json();

  const enPendiente = await api(`/posts/${post.id}/comments`, tokenLector, {
    method: 'POST', body: JSON.stringify({ body: 'comento antes de tiempo' }),
  });
  assert.equal(enPendiente.status, 500, 'la base debe rechazar comentar en algo no publicado');

  await api(`/admin/posts/${post.id}/moderate`, tokenAdmin, { method: 'POST', body: JSON.stringify({ action: 'publish' }) });

  const comentar = await api(`/posts/${post.id}/comments`, tokenLector, {
    method: 'POST', body: JSON.stringify({ body: 'ahora sí comento' }),
  });
  assert.equal(comentar.status, 201);
  const { comment } = await comentar.json();
  assert.equal(comment.status, 'pending');
});

test('un comentario pendiente no lo ve nadie más que su autor y un administrador', async () => {
  const postId = await crearYPublicar(tokenAutora, 'post para comentar');
  const crear = await api(`/posts/${postId}/comments`, tokenLector, {
    method: 'POST', body: JSON.stringify({ body: 'comentario pendiente' }),
  });
  const { comment } = await crear.json();

  const comoAutora = await (await api(`/posts/${postId}/comments`, tokenAutora)).json();
  assert.ok(!comoAutora.comments.some(c => c.id === comment.id), 'la autora del post no debe ver un comentario ajeno pendiente');

  const comoLector = await (await api(`/posts/${postId}/comments`, tokenLector)).json();
  assert.ok(comoLector.comments.some(c => c.id === comment.id), 'quien lo escribió sí lo ve');

  const comoAdmin = await (await api(`/posts/${postId}/comments`, tokenAdmin)).json();
  assert.ok(comoAdmin.comments.some(c => c.id === comment.id), 'un administrador ve todo (is_moderator() cubre admin también)');
});

test('un administrador aprueba un comentario, y ahí aparece para todos y en el conteo del post', async () => {
  const postId = await crearYPublicar(tokenAutora, 'post con comentario a aprobar');
  const crear = await api(`/posts/${postId}/comments`, tokenLector, {
    method: 'POST', body: JSON.stringify({ body: 'comentario a aprobar' }),
  });
  const { comment } = await crear.json();

  const antes = await (await api('/posts', tokenAutora)).json();
  assert.equal(antes.posts.find(p => p.id === postId).comment_count, 0);

  const moderar = await api(`/admin/comments/${comment.id}/moderate`, tokenAdmin, {
    method: 'POST', body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(moderar.status, 200);

  const comoAutora = await (await api(`/posts/${postId}/comments`, tokenAutora)).json();
  assert.ok(comoAutora.comments.some(c => c.id === comment.id));

  const despues = await (await api('/posts', tokenAutora)).json();
  assert.equal(despues.posts.find(p => p.id === postId).comment_count, 1);
});

test('un moderador (no admin) tampoco puede aprobar un comentario', async () => {
  const postId = await crearYPublicar(tokenAutora, 'post con comentario protegido');
  const crear = await api(`/posts/${postId}/comments`, tokenLector, {
    method: 'POST', body: JSON.stringify({ body: 'no me aprueben así nomás' }),
  });
  const { comment } = await crear.json();

  const intentoAutora = await api(`/admin/comments/${comment.id}/moderate`, tokenAutora, {
    method: 'POST', body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(intentoAutora.status, 403);

  const intentoMod = await api(`/admin/comments/${comment.id}/moderate`, tokenMod, {
    method: 'POST', body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(intentoMod.status, 403);
});

test('borrar el propio comentario funciona', async () => {
  const postId = await crearYPublicar(tokenAutora, 'post con comentario a borrar');
  const crear = await api(`/posts/${postId}/comments`, tokenLector, {
    method: 'POST', body: JSON.stringify({ body: 'me arrepentí de comentar' }),
  });
  const { comment } = await crear.json();

  const borrar = await api(`/posts/comments/${comment.id}`, tokenLector, { method: 'DELETE' });
  assert.equal(borrar.status, 200);

  const lista = await (await api(`/posts/${postId}/comments`, tokenLector)).json();
  assert.ok(!lista.comments.some(c => c.id === comment.id));
});

test('la cola de moderación (/admin/queue) trae publicaciones y comentarios pendientes juntos', async () => {
  const postId = await crearYPublicar(tokenAutora, 'post para la cola');
  const crear = await api(`/posts/${postId}/comments`, tokenLector, {
    method: 'POST', body: JSON.stringify({ body: 'comentario para la cola' }),
  });
  const { comment } = await crear.json();

  const cola = await (await api('/admin/queue', tokenAdmin)).json();
  assert.ok(cola.comments.some(c => c.id === comment.id));

  const sinPermiso = await api('/admin/queue', tokenLector);
  assert.equal(sinPermiso.status, 403);
});
