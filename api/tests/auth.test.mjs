// Pruebas del login por código de correo, de punta a punta sobre HTTP.
//
//   bash api/run-tests.sh
//
// No se mockea nada: se levanta el servidor real en un puerto efímero, contra
// el Postgres real de la prueba. El código se intercepta del log de
// mailer.js en modo desarrollo — es el mismo mecanismo que ya existe para
// probar el flujo completo sin depender de un proveedor de correo real.

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

const PASSWORD_EMAIL = 'password-test@upb.edu.co';
const PASSWORD_VALUE = 'clave-super-secreta';
await owner.query(`delete from auth.users where email = $1`, [PASSWORD_EMAIL]);
await owner.query(
  // costo bajo (4) a propósito: solo para que las pruebas no se sientan lentas.
  `insert into auth.users (email, password_hash) values ($1, crypt($2, gen_salt('bf', 4)))`,
  [PASSWORD_EMAIL, PASSWORD_VALUE]
);

test.after(async () => {
  await owner.query(`delete from auth.users where email = $1`, [PASSWORD_EMAIL]);
  await owner.end();
  await new Promise((resolve) => server.close(resolve));
  await closePool();
});

async function capturarLog(fn) {
  const original = console.log;
  let capturado = '';
  console.log = (...args) => { capturado += args.join(' ') + '\n'; };
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return capturado;
}

const post = (path, body) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

async function pedirCodigo(email) {
  let respuesta;
  const salida = await capturarLog(async () => {
    respuesta = await post('/auth/request-code', { email });
  });
  assert.equal(respuesta.status, 202);
  const match = salida.match(/código para .*: (\d{6})/);
  assert.ok(match, `no se encontró el código en el log: ${salida}`);
  return match[1];
}

test('un correo fuera de upb.edu.co no puede pedir código', async () => {
  const res = await post('/auth/request-code', { email: 'quien@gmail.com' });
  assert.equal(res.status, 400);
});

test('código correcto entrega un token de sesión utilizable', async () => {
  const email = 'flujo-completo@upb.edu.co';
  const codigo = await pedirCodigo(email);

  const res = await post('/auth/verify-code', { email, code: codigo });
  assert.equal(res.status, 200);
  const { token } = await res.json();
  assert.equal(typeof token, 'string');
  assert.equal(token.split('.').length, 3, 'debe ser un JWT de 3 partes');
});

test('el mismo código no sirve una segunda vez', async () => {
  const email = 'un-solo-uso@upb.edu.co';
  const codigo = await pedirCodigo(email);

  const primera = await post('/auth/verify-code', { email, code: codigo });
  assert.equal(primera.status, 200);

  const segunda = await post('/auth/verify-code', { email, code: codigo });
  assert.equal(segunda.status, 401);
});

test('un código equivocado no pasa', async () => {
  const email = 'codigo-malo@upb.edu.co';
  await pedirCodigo(email);

  const res = await post('/auth/verify-code', { email, code: '000000' });
  assert.equal(res.status, 401);
});

test('demasiados intentos fallidos bloquean el código, y uno nuevo sí funciona', async () => {
  const email = 'fuerza-bruta@upb.edu.co';
  await pedirCodigo(email);

  let ultimo;
  for (let i = 0; i < 6; i++) {
    ultimo = await post('/auth/verify-code', { email, code: '111111' });
  }
  assert.equal(ultimo.status, 401, 'el sexto intento ya debería estar bloqueado');

  // El código viejo quedó inutilizable, pero eso no debe dejar a la persona
  // esperando el enfriamiento entero para poder pedir uno nuevo.
  const nuevo = await pedirCodigo(email);
  const res = await post('/auth/verify-code', { email, code: nuevo });
  assert.equal(res.status, 200, 'un código nuevo debería funcionar aunque el anterior se haya bloqueado');
});

test('pedir código dos veces seguido no revela si ya había uno vigente', async () => {
  const email = 'doble-pedido@upb.edu.co';
  const primera = await post('/auth/request-code', { email });
  const segunda = await post('/auth/request-code', { email });
  assert.equal(primera.status, 202);
  assert.equal(segunda.status, 202, 'la respuesta debe ser igual, sin filtrar el estado interno');
});

// ── login por correo y contraseña ────────────────────────────────────────────

test('contraseña correcta entrega un token, y /me devuelve el correo de la sesión', async () => {
  const res = await post('/auth/login-password', { email: PASSWORD_EMAIL, password: PASSWORD_VALUE });
  assert.equal(res.status, 200);
  const { token } = await res.json();
  assert.equal(token.split('.').length, 3);

  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(me.status, 200);
  const body = await me.json();
  assert.equal(body.email, PASSWORD_EMAIL);
});

test('contraseña equivocada no entrega token', async () => {
  const res = await post('/auth/login-password', { email: PASSWORD_EMAIL, password: 'no-es-esta' });
  assert.equal(res.status, 401);
});

test('un correo sin password_hash (cuenta de código) no puede entrar con contraseña', async () => {
  const res = await post('/auth/login-password', { email: 'nunca-tuvo-clave@upb.edu.co', password: 'lo-que-sea' });
  assert.equal(res.status, 401);
});

test('/me sin token no funciona', async () => {
  const res = await fetch(`${base}/auth/me`);
  assert.equal(res.status, 401);
});

test('demasiados intentos de contraseña fallidos bloquean, aunque la contraseña sea correcta', async () => {
  const email = 'freno-de-fuerza-bruta@upb.edu.co';
  let ultimo;
  for (let i = 0; i < 10; i++) {
    ultimo = await post('/auth/login-password', { email, password: 'lo-que-sea' });
  }
  assert.equal(ultimo.status, 401, 'las primeras diez fallan por credenciales, no por el freno');

  const bloqueado = await post('/auth/login-password', { email, password: PASSWORD_VALUE });
  assert.equal(bloqueado.status, 429, 'la número once debe bloquear, incluso con la contraseña correcta');
});

// ── perfil ────────────────────────────────────────────────────────────────

async function tokenParaPerfil() {
  const res = await post('/auth/login-password', { email: PASSWORD_EMAIL, password: PASSWORD_VALUE });
  return (await res.json()).token;
}

test('/me trae el perfil recién creado, con display_name vacío', async () => {
  const token = await tokenParaPerfil();
  const res = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${token}` } });
  const body = await res.json();
  assert.equal(body.display_name, null);
  assert.equal(body.role, 'student');
  assert.ok(body.created_at, 'debe traer la fecha de alta');
});

test('PATCH /profile cambia el nombre, y /me lo refleja después', async () => {
  const token = await tokenParaPerfil();
  const patch = await fetch(`${base}/auth/profile`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ displayName: 'Jerdirlson' }),
  });
  assert.equal(patch.status, 200);

  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal((await me.json()).display_name, 'Jerdirlson');
});

test('PATCH /profile rechaza un nombre demasiado corto', async () => {
  const token = await tokenParaPerfil();
  const res = await fetch(`${base}/auth/profile`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ displayName: 'A' }),
  });
  assert.equal(res.status, 400);
});

test('PATCH /profile sin token no funciona', async () => {
  const res = await fetch(`${base}/auth/profile`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: 'Nadie' }),
  });
  assert.equal(res.status, 401);
});
