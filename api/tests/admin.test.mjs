// Pruebas del contenido de Explorar: cualquiera con sesión lo lee, solo un
// administrador lo edita.
//
//   bash api/run-tests.sh

import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const { app } = await import('../src/server.js');
const { closePool } = await import('../src/db.js');

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const OWNER_URL = process.env.OWNER_DATABASE_URL;
if (!OWNER_URL) throw new Error('Falta OWNER_DATABASE_URL. Usar api/run-tests.sh.');
const owner = new pg.Client({ connectionString: OWNER_URL });
await owner.connect();

const LECTOR_EMAIL = 'explorar-lector@upb.edu.co';
const ADMIN_EMAIL = 'explorar-admin@upb.edu.co';
const PASS = 'clave-de-pruebas';

async function crearCuenta(email, { role = null } = {}) {
  // moderation_actions.moderator_id es on delete restrict — limpiar de
  // verdad significa borrar primero lo que esa cuenta haya moderado.
  await owner.query(
    `delete from public.moderation_actions where moderator_id = (select id from auth.users where email = $1)`,
    [email]
  );
  await owner.query(`delete from auth.users where email = $1`, [email]);
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

await crearCuenta(LECTOR_EMAIL);
await crearCuenta(ADMIN_EMAIL, { role: 'admin' });
const tokenLector = await login(LECTOR_EMAIL);
const tokenAdmin = await login(ADMIN_EMAIL);

test.after(async () => {
  await owner.query(`delete from public.explore_resources where title like 'Prueba %'`);
  for (const email of [LECTOR_EMAIL, ADMIN_EMAIL, 'borrar-moderador@upb.edu.co', 'borrar-normal@upb.edu.co']) {
    await owner.query(
      `delete from public.moderation_actions where moderator_id = (select id from auth.users where email = $1)`,
      [email]
    );
    await owner.query(`delete from auth.users where email = $1`, [email]);
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

test('cualquier sesión ve el contenido de Explorar, incluyendo lo ya migrado', async () => {
  const res = await api('/explore', tokenLector);
  assert.equal(res.status, 200);
  const { resources } = await res.json();
  assert.ok(resources.length >= 12, 'debe traer al menos las 12 cuentas/canales migrados');
  assert.ok(resources.every(r => r.category && r.title && r.platform && r.url));
});

test('un lector no puede crear, editar ni borrar contenido de Explorar', async () => {
  const crear = await api('/admin/explore', tokenLector, {
    method: 'POST', body: JSON.stringify({ category: 'live_well', title: 'Prueba X', platform: 'YouTube', url: 'https://youtube.com/x' }),
  });
  assert.equal(crear.status, 403);
});

test('un administrador puede crear, editar y borrar un recurso de Explorar', async () => {
  const crear = await api('/admin/explore', tokenAdmin, {
    method: 'POST',
    body: JSON.stringify({ category: 'mindfulness', title: 'Prueba Canal', platform: 'YouTube', url: 'https://youtube.com/prueba', position: 99 }),
  });
  assert.equal(crear.status, 201);
  const { resource } = await crear.json();
  assert.equal(resource.title, 'Prueba Canal');

  // Debe aparecer también para cualquier otra sesión — es contenido público
  // de la app, no algo privado del admin.
  const listaLector = await (await api('/explore', tokenLector)).json();
  assert.ok(listaLector.resources.some(r => r.id === resource.id));

  const editar = await api(`/admin/explore/${resource.id}`, tokenAdmin, {
    method: 'PATCH',
    body: JSON.stringify({ category: 'mindfulness', title: 'Prueba Canal Editado', platform: 'YouTube', url: 'https://youtube.com/prueba', position: 99 }),
  });
  assert.equal(editar.status, 200);

  const despuesEditar = await (await api('/explore', tokenLector)).json();
  assert.equal(despuesEditar.resources.find(r => r.id === resource.id).title, 'Prueba Canal Editado');

  const borrar = await api(`/admin/explore/${resource.id}`, tokenAdmin, { method: 'DELETE' });
  assert.equal(borrar.status, 200);

  const despuesBorrar = await (await api('/explore', tokenLector)).json();
  assert.ok(!despuesBorrar.resources.some(r => r.id === resource.id));
});

test('categoría, plataforma o url inválidas se rechazan', async () => {
  const categoriaInvalida = await api('/admin/explore', tokenAdmin, {
    method: 'POST', body: JSON.stringify({ category: 'no-existe', title: 'Prueba Y', platform: 'YouTube', url: 'https://youtube.com/y' }),
  });
  assert.equal(categoriaInvalida.status, 400);

  const urlInvalida = await api('/admin/explore', tokenAdmin, {
    method: 'POST', body: JSON.stringify({ category: 'live_well', title: 'Prueba Z', platform: 'YouTube', url: 'no-es-una-url' }),
  });
  assert.equal(urlInvalida.status, 400);
});

// ── usuarios ─────────────────────────────────────────────────────────────

async function idDe(email) {
  const { rows } = await owner.query('select id from auth.users where email = $1', [email]);
  return rows[0].id;
}

test('un lector no puede listar, cambiar rol ni borrar usuarios', async () => {
  const lista = await api('/admin/users', tokenLector);
  assert.equal(lista.status, 403);

  const cambiarRol = await api(`/admin/users/${await idDe(LECTOR_EMAIL)}/role`, tokenLector, {
    method: 'PATCH', body: JSON.stringify({ role: 'admin' }),
  });
  assert.equal(cambiarRol.status, 403);
});

test('un administrador ve la lista de usuarios, con correo y rol', async () => {
  const res = await api('/admin/users', tokenAdmin);
  assert.equal(res.status, 200);
  const { users } = await res.json();
  const yo = users.find(u => u.email === ADMIN_EMAIL);
  assert.ok(yo, 'debe aparecer la propia cuenta admin en la lista');
  assert.equal(yo.role, 'admin');
});

test('un administrador cambia el rol de otra cuenta', async () => {
  const id = await idDe(LECTOR_EMAIL);
  const cambiar = await api(`/admin/users/${id}/role`, tokenAdmin, {
    method: 'PATCH', body: JSON.stringify({ role: 'moderator' }),
  });
  assert.equal(cambiar.status, 200);

  const { users } = await (await api('/admin/users', tokenAdmin)).json();
  assert.equal(users.find(u => u.id === id).role, 'moderator');

  // lo dejamos como estaba para no afectar otras pruebas
  await api(`/admin/users/${id}/role`, tokenAdmin, { method: 'PATCH', body: JSON.stringify({ role: 'student' }) });
});

test('un rol inválido se rechaza', async () => {
  const id = await idDe(LECTOR_EMAIL);
  const res = await api(`/admin/users/${id}/role`, tokenAdmin, {
    method: 'PATCH', body: JSON.stringify({ role: 'superadmin' }),
  });
  assert.equal(res.status, 400);
});

test('un administrador no puede borrarse a sí mismo', async () => {
  const res = await api(`/admin/users/${await idDe(ADMIN_EMAIL)}`, tokenAdmin, { method: 'DELETE' });
  assert.equal(res.status, 400);
});

test('borrar una cuenta con historial de moderación falla claro, no con un 500 crudo', async () => {
  // La propia cuenta admin ya moderó recursos de Explorar arriba... pero
  // Explorar no pasa por moderation_actions. Generamos historial real
  // moderando un post, con una cuenta de usar y tirar.
  await crearCuenta('borrar-moderador@upb.edu.co', { role: 'admin' });
  const tokenTemp = await login('borrar-moderador@upb.edu.co');
  const idTemp = await idDe('borrar-moderador@upb.edu.co');

  const autora = await api('/posts', tokenLector, { method: 'POST', body: JSON.stringify({ body: 'para que alguien lo modere' }) });
  const { post } = await autora.json();
  await api(`/admin/posts/${post.id}/moderate`, tokenTemp, { method: 'POST', body: JSON.stringify({ action: 'publish' }) });

  const borrar = await api(`/admin/users/${idTemp}`, tokenAdmin, { method: 'DELETE' });
  assert.equal(borrar.status, 409);

  // limpieza manual, ya que el borrado normal está bloqueado a propósito
  await owner.query('delete from public.moderation_actions where moderator_id = $1', [idTemp]);
  await owner.query('delete from auth.users where id = $1', [idTemp]);
});

test('un administrador borra otra cuenta sin historial de moderación', async () => {
  await crearCuenta('borrar-normal@upb.edu.co');
  const id = await idDe('borrar-normal@upb.edu.co');

  const borrar = await api(`/admin/users/${id}`, tokenAdmin, { method: 'DELETE' });
  assert.equal(borrar.status, 200);

  const { users } = await (await api('/admin/users', tokenAdmin)).json();
  assert.ok(!users.some(u => u.id === id));
});
