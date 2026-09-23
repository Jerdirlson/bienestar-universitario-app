// Ayudantes compartidos por las pruebas del contrato v2. No es un archivo de
// pruebas (no termina en .test.mjs): run-tests.sh no lo corre solo.
//
// Mismo enfoque que las pruebas existentes: servidor real en un puerto
// efímero, Postgres real, sin mocks. La siembra y las comprobaciones "desde
// afuera" van con el dueño de la base (OWNER_DATABASE_URL), que no está
// sujeto a las políticas.

import pg from 'pg';

export const PASS = 'clave-de-pruebas';

// Algo que el filtro siempre retiene para revisión (dato personal).
export const EN_REVISION = ' · escríbeme a prueba@correo.com';

export async function startApi() {
  const { app } = await import('../src/server.js');
  const { closePool } = await import('../src/db.js');

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const OWNER_URL = process.env.OWNER_DATABASE_URL;
  if (!OWNER_URL) throw new Error('Falta OWNER_DATABASE_URL. Usar api/run-tests.sh.');
  const owner = new pg.Client({ connectionString: OWNER_URL });
  await owner.connect();

  const emails = new Set();

  async function borrarCuenta(email) {
    await owner.query(
      `delete from public.moderation_actions where moderator_id = (select id from auth.users where email = $1)`,
      [email]
    );
    await owner.query('delete from auth.users where email = $1', [email]);
  }

  /** Crea (o recrea) una cuenta y devuelve { id, token, publicId }. */
  async function cuenta(email, { role = null, name = null } = {}) {
    emails.add(email);
    await borrarCuenta(email);
    const { rows } = await owner.query(
      `insert into auth.users (email, password_hash) values ($1, crypt($2, gen_salt('bf', 4))) returning id`,
      [email, PASS]
    );
    const id = rows[0].id;
    if (role) await owner.query('update public.profiles set role = $2 where id = $1', [id, role]);
    if (name) await owner.query('update public.profiles set display_name = $2 where id = $1', [id, name]);
    const pub = await owner.query('select public_id from public.profiles where id = $1', [id]);
    const res = await fetch(`${base}/auth/login-password`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASS }),
    });
    const { token } = await res.json();
    return { id, token, publicId: pub.rows[0].public_id, email };
  }

  const api = (path, token, opts = {}) =>
    fetch(`${base}${path}`, {
      ...opts,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      },
    });

  /** Petición + JSON en un paso: { status, body }. */
  async function call(method, path, token, body) {
    const res = await api(path, token, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, body: json };
  }

  async function stop() {
    for (const email of emails) await borrarCuenta(email);
    await owner.end();
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  }

  return { base, owner, cuenta, api, call, stop };
}
