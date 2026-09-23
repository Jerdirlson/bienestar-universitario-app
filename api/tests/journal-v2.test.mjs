// Pruebas del diario (check-in y diario libre), los retos y el borrado de
// cuenta.
//
//   bash api/run-tests.sh
//
// El diario es la regla que no se negocia: cada prueba de privacidad intenta
// leer o pisar lo de otra persona — incluida una cuenta administradora — y
// comprueba que no pasa nada.

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startApi } from './helpers.mjs';

const { owner, cuenta, call, stop } = await startApi();

const ana = await cuenta('diario-ana@upb.edu.co', { name: 'Ana Diario' });
const beto = await cuenta('diario-beto@upb.edu.co');
const admin = await cuenta('diario-admin@upb.edu.co', { role: 'admin' });

test.after(stop);

// ── check-in diario ──────────────────────────────────────────────────────

test('PUT /entries/:date crea y actualiza el check-in del día', async () => {
  const r = await call('PUT', '/entries/2026-09-20', ana.token, { mood: 3, feelings: ['calma'], causes: ['estudios'], note: 'buen día' });
  assert.equal(r.status, 200);
  assert.equal(r.body.entry.entry_date, '2026-09-20', 'la fecha vuelve tal cual, sin correrse por zona horaria');
  assert.deepEqual(r.body.entry.feelings, ['calma']);

  const otra = await call('PUT', '/entries/2026-09-20', ana.token, { mood: 1, feelings: [], causes: [], note: null });
  assert.equal(otra.body.entry.mood, 1, 'upsert: uno por día');

  const lista = (await call('GET', '/entries', ana.token)).body.entries;
  assert.equal(lista.filter((e) => e.entry_date === '2026-09-20').length, 1);
  for (const k of ['entry_date', 'mood', 'feelings', 'causes', 'note', 'created_at', 'updated_at']) {
    assert.ok(k in lista[0], `falta ${k}`);
  }
});

test('GET /entries viene ordenado, más reciente primero', async () => {
  await call('PUT', '/entries/2026-09-18', ana.token, { mood: 2 });
  await call('PUT', '/entries/2026-09-21', ana.token, { mood: 2 });
  const fechas = (await call('GET', '/entries', ana.token)).body.entries.map((e) => e.entry_date);
  assert.deepEqual(fechas, [...fechas].sort().reverse());
});

test('check-in inválido: entrada_invalida', async () => {
  for (const body of [{ mood: 5 }, { mood: 1.5 }, { mood: 2, feelings: 'calma' }, { mood: 2, note: 'x'.repeat(4001) }, {}]) {
    const r = await call('PUT', '/entries/2026-09-19', ana.token, body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(r.body.error, 'entrada_invalida');
  }
  assert.equal((await call('PUT', '/entries/2026-02-30', ana.token, { mood: 2 })).status, 400);
  assert.equal((await call('PUT', '/entries/ayer', ana.token, { mood: 2 })).status, 400);
});

test('el check-in es privado: ni otra persona ni un administrador lo ven', async () => {
  await call('PUT', '/entries/2026-09-22', ana.token, { mood: 4, note: 'secreto de Ana' });
  for (const who of [beto, admin]) {
    const lista = (await call('GET', '/entries', who.token)).body.entries;
    assert.ok(!JSON.stringify(lista).includes('secreto de Ana'));
  }
  // Escribir "la misma fecha" como otra persona crea SU fila, no pisa la de Ana.
  await call('PUT', '/entries/2026-09-22', beto.token, { mood: 0, note: 'de Beto' });
  const deAna = (await call('GET', '/entries', ana.token)).body.entries.find((e) => e.entry_date === '2026-09-22');
  assert.equal(deAna.note, 'secreto de Ana');
});

test('DELETE /entries/:date es idempotente y solo borra lo propio', async () => {
  await call('PUT', '/entries/2026-09-17', ana.token, { mood: 2 });
  await call('PUT', '/entries/2026-09-17', beto.token, { mood: 2 });
  assert.equal((await call('DELETE', '/entries/2026-09-17', beto.token)).status, 200);
  assert.equal((await call('DELETE', '/entries/2026-09-17', beto.token)).status, 200, 'aunque ya no exista');
  assert.ok((await call('GET', '/entries', ana.token)).body.entries.some((e) => e.entry_date === '2026-09-17'));
  assert.equal((await call('DELETE', '/entries/2001-01-01', ana.token)).status, 200);
});

// ── diario libre ─────────────────────────────────────────────────────────

test('PUT /journal/:id crea con id del cliente y actualiza', async () => {
  const id = crypto.randomUUID();
  const creado = await call('PUT', `/journal/${id}`, ana.token, {
    title: 'Hoy', body: 'Escribo para mí', promptKey: 'gratitud', mood: 3, createdAt: '2026-09-20T15:00:00Z',
  });
  assert.equal(creado.status, 200);
  const e = creado.body.entry;
  assert.equal(e.id, id);
  assert.equal(e.prompt_key, 'gratitud');
  assert.equal(new Date(e.created_at).toISOString(), '2026-09-20T15:00:00.000Z', 'respeta createdAt del cliente');
  for (const k of ['id', 'title', 'body', 'prompt_key', 'mood', 'created_at', 'updated_at']) assert.ok(k in e);

  const editado = await call('PUT', `/journal/${id}`, ana.token, { body: 'Cambié de idea', createdAt: '2020-01-01T00:00:00Z' });
  assert.equal(editado.body.entry.body, 'Cambié de idea');
  assert.equal(editado.body.entry.title, null);
  assert.equal(new Date(editado.body.entry.created_at).toISOString(), '2026-09-20T15:00:00.000Z', 'editar no cambia la fecha');

  const lista = (await call('GET', '/journal', ana.token)).body.entries;
  assert.ok(lista.some((x) => x.id === id));
});

test('diario libre inválido: entrada_invalida', async () => {
  const id = crypto.randomUUID();
  for (const body of [{}, { body: '   ' }, { body: 'x'.repeat(10001) }, { body: 'ok', title: 'x'.repeat(121) },
    { body: 'ok', promptKey: 'x'.repeat(41) }, { body: 'ok', mood: 7 }, { body: 'ok', createdAt: 'mañana' }]) {
    const r = await call('PUT', `/journal/${id}`, ana.token, body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(r.body.error, 'entrada_invalida');
  }
  assert.equal((await call('PUT', '/journal/no-es-uuid', ana.token, { body: 'ok' })).status, 400);
});

test('el diario libre es privado: nadie más lo lee ni lo pisa', async () => {
  const id = crypto.randomUUID();
  await call('PUT', `/journal/${id}`, ana.token, { body: 'lo más privado de Ana' });

  for (const who of [beto, admin]) {
    const lista = (await call('GET', '/journal', who.token)).body.entries;
    assert.ok(!lista.some((x) => x.id === id));
  }
  // Mismo id, otra persona: la base rechaza pisarlo y el API no dice que existe.
  const pisar = await call('PUT', `/journal/${id}`, beto.token, { body: 'reescrito por Beto' });
  assert.equal(pisar.status, 404);
  await call('DELETE', `/journal/${id}`, beto.token);
  const { rows } = await owner.query('select body from public.journal_entries where id = $1', [id]);
  assert.equal(rows[0].body, 'lo más privado de Ana', 'ni se editó ni se borró');
});

test('el diario nunca pasa por el filtro de moderación', async () => {
  const id = crypto.randomUUID();
  const r = await call('PUT', `/journal/${id}`, ana.token, { body: 'hoy me quiero morir, necesito escribirlo' });
  assert.equal(r.status, 200, 'se guarda tal cual, sin retener nada');
  assert.ok(!('moderation' in r.body));
  const cola = (await call('GET', '/admin/queue', admin.token)).body;
  assert.ok(!JSON.stringify(cola).includes('necesito escribirlo'));
  const stats = (await call('GET', '/admin/stats', admin.token)).body;
  assert.ok(!/journal|entries|diario/i.test(JSON.stringify(Object.keys(stats))));
});

test('DELETE /journal/:id es idempotente', async () => {
  const id = crypto.randomUUID();
  await call('PUT', `/journal/${id}`, ana.token, { body: 'para borrar' });
  assert.equal((await call('DELETE', `/journal/${id}`, ana.token)).status, 200);
  assert.equal((await call('DELETE', `/journal/${id}`, ana.token)).status, 200);
  assert.ok(!(await call('GET', '/journal', ana.token)).body.entries.some((x) => x.id === id));
});

// ── retos ────────────────────────────────────────────────────────────────

async function hoyBogota() {
  const { rows } = await owner.query(`select to_char((now() at time zone 'America/Bogota')::date, 'YYYY-MM-DD') as d`);
  return rows[0].d;
}

test('GET /challenges: catálogo con título por idioma y estado propio', async () => {
  const es = (await call('GET', '/challenges', beto.token)).body.challenges;
  assert.ok(es.length >= 4);
  for (const k of ['key', 'title', 'total_days', 'joined', 'completed_days', 'completed_at', 'checked_today']) {
    assert.ok(k in es[0], `falta ${k}`);
  }
  const en = (await call('GET', '/challenges?lang=en', beto.token)).body.challenges;
  assert.equal(en.find((c) => c.key === 'gratitude_7').title, '7 days of gratitude');
  assert.equal(es.find((c) => c.key === 'gratitude_7').title, '7 días de gratitud');
});

test('retos: unirse, sumar un día, no dos el mismo día, y abandonar', async () => {
  const hoy = await hoyBogota();
  const unirse = await call('POST', '/challenges/breathing_7/join', beto.token);
  assert.equal(unirse.status, 200);
  assert.equal(unirse.body.challenge.joined, true);

  const p = await call('POST', '/challenges/breathing_7/progress', beto.token, { date: hoy });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.challenge.completed_days, 1);
  assert.equal(p.body.challenge.checked_today, true);

  const otra = await call('POST', '/challenges/breathing_7/progress', beto.token, { date: hoy });
  assert.equal(otra.status, 409);
  assert.equal(otra.body.error, 'ya_registrado_hoy');

  const lista = (await call('GET', `/challenges?date=${hoy}`, beto.token)).body.challenges;
  assert.equal(lista.find((c) => c.key === 'breathing_7').checked_today, true);
  const otroDia = (await call('GET', '/challenges?date=2000-01-01', beto.token)).body.challenges;
  assert.equal(otroDia.find((c) => c.key === 'breathing_7').checked_today, false, '?date= decide qué es "hoy"');

  assert.equal((await call('DELETE', '/challenges/breathing_7', beto.token)).status, 200);
  const despues = (await call('GET', '/challenges', beto.token)).body.challenges.find((c) => c.key === 'breathing_7');
  assert.equal(despues.joined, false);
  assert.equal(despues.completed_days, 0);
});

test('retos: completar marca completed_at, fechas lejanas no valen, clave inexistente 404', async () => {
  // Reto de prueba de 1 día, sembrado por el dueño (el catálogo es de solo lectura).
  await owner.query(
    `insert into public.challenges (key, title_es, title_en, total_days) values ('prueba_1', 'Prueba', 'Test', 1)
       on conflict (key) do nothing`
  );
  try {
    const hoy = await hoyBogota();
    const r = await call('POST', '/challenges/prueba_1/progress', beto.token, { date: hoy });
    assert.equal(r.status, 200, 'sin unirse antes, se une solo');
    assert.equal(r.body.challenge.completed_days, 1);
    assert.ok(r.body.challenge.completed_at);

    const lejos = await call('POST', '/challenges/sleep_14/progress', beto.token, { date: '2020-01-01' });
    assert.equal(lejos.status, 400);
    assert.equal(lejos.body.error, 'fecha_invalida');

    assert.equal((await call('POST', '/challenges/no_existe/join', beto.token)).status, 404);
  } finally {
    await owner.query(`delete from public.challenges where key = 'prueba_1'`);
  }
});

// ── borrar la cuenta ─────────────────────────────────────────────────────

test('DELETE /auth/account borra la cuenta y todo lo suyo', async () => {
  const temp = await cuenta('diario-temp@upb.edu.co', { name: 'Temporal' });
  await call('PUT', '/entries/2026-09-20', temp.token, { mood: 2, note: 'x' });
  await call('PUT', `/journal/${crypto.randomUUID()}`, temp.token, { body: 'x' });
  await call('POST', '/posts', temp.token, { body: 'me voy', isAnonymous: false });

  const r = await call('DELETE', '/auth/account', temp.token);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  for (const [table, col] of [['auth.users', 'id'], ['public.profiles', 'id'], ['public.entries', 'user_id'],
    ['public.journal_entries', 'user_id'], ['public.posts', 'author_id']]) {
    const { rows } = await owner.query(`select count(*)::int as n from ${table} where ${col} = $1`, [temp.id]);
    assert.equal(rows[0].n, 0, `quedó algo en ${table}`);
  }

  // El token sigue bien firmado, pero la cuenta ya no existe: /auth/me no
  // puede responder 200 con todo en null (la app se quedaba "con sesión" sin
  // poder guardar nada). Es una sesión inválida.
  const me = await call('GET', '/auth/me', temp.token);
  assert.equal(me.status, 401);
  assert.equal(me.body.error, 'sesion_invalida');
});

test('DELETE /auth/account: con historial de moderación, 409', async () => {
  const mod = await cuenta('diario-mod@upb.edu.co', { role: 'admin' });
  await owner.query(
    `insert into public.moderation_actions (moderator_id, action, note) values ($1, 'publish', 'prueba')`,
    [mod.id]
  );
  const r = await call('DELETE', '/auth/account', mod.token);
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'tiene_historial_de_moderacion');
});
