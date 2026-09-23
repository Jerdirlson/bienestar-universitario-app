// Pruebas de la capa de bienestar: retos (remoto v2 y local v1), una vez por
// día con el día local, logros solo con datos reales, respiración y artículos.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import {
  createChallengesClient, ChallengeError, LOCAL_CATALOG, CHALLENGES_STORAGE_KEY,
  activeChallenges, completedChallenges, availableChallenges,
} from '../src/data/challenges.js';
import { createExerciseLog, summarizeExercises } from '../src/data/exercises.js';
import { computeAchievements, longestStreak } from '../src/data/achievements.js';
import { createMemoryBackend } from '../src/data/entriesRepository.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ── dobles ──────────────────────────────────────────────────────────────────

/** fetch simulado: `routes` = { 'GET /challenges': (req) => [status, body] } */
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    const u = new URL(url);
    const method = opts.method ?? 'GET';
    const key = `${method} ${u.pathname}`;
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method, path: u.pathname, search: u.search, body, headers: opts.headers });
    const handler = routes[key];
    const [status, data] = handler ? handler({ body, url: u }) : [404, { error: 'not_found' }];
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    };
  };
  fn.calls = calls;
  return fn;
}

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0);

function localClient(extra = {}) {
  const storage = createMemoryBackend();
  const client = createChallengesClient({
    apiUrl: 'https://api.test', token: 'tok', apiVersion: 1,
    fetchImpl: fakeFetch({}), storage, lang: 'es', ...extra,
  });
  return { client, storage };
}

// ── remoto (v2) ─────────────────────────────────────────────────────────────

test('v2: lista desde GET /challenges con idioma y token', async () => {
  const fetchImpl = fakeFetch({
    'GET /challenges': () => [200, { challenges: [
      { key: 'breathing_7', title: '7 days of breathing', total_days: 7, joined: true, completed_days: 2, completed_at: null, checked_today: false },
    ] }],
  });
  const client = createChallengesClient({
    apiUrl: 'https://api.test', token: 'tok', apiVersion: 2, fetchImpl, storage: createMemoryBackend(), lang: 'en',
  });
  const list = await client.list();
  assert.equal(client.mode, 'remote');
  assert.equal(list[0].title, '7 days of breathing');
  assert.equal(list[0].completed_days, 2);
  assert.equal(fetchImpl.calls[0].search, '?lang=en');
  assert.equal(fetchImpl.calls[0].headers.authorization, 'Bearer tok');
});

test('v2: registrar manda el día local y propaga 409 ya_registrado_hoy', async () => {
  let n = 0;
  const fetchImpl = fakeFetch({
    'POST /challenges/sleep_14/progress': () => (++n === 1 ? [200, { ok: true }] : [409, { error: 'ya_registrado_hoy' }]),
  });
  const client = createChallengesClient({
    apiUrl: 'https://api.test', token: 'tok', apiVersion: 2, fetchImpl, storage: createMemoryBackend(),
  });
  await client.checkIn('sleep_14', at(2026, 9, 23, 23));
  assert.deepEqual(fetchImpl.calls[0].body, { date: '2026-09-23' });
  await assert.rejects(client.checkIn('sleep_14', at(2026, 9, 23, 23)),
    (e) => e instanceof ChallengeError && e.code === 'ya_registrado_hoy' && e.status === 409);
});

test('v2: unirse y abandonar usan las rutas del contrato', async () => {
  const fetchImpl = fakeFetch({
    'POST /challenges/walk_30/join': () => [200, { ok: true }],
    'DELETE /challenges/walk_30': () => [200, { ok: true }],
  });
  const client = createChallengesClient({
    apiUrl: 'https://api.test', token: 'tok', apiVersion: 2, fetchImpl, storage: createMemoryBackend(),
  });
  await client.join('walk_30');
  await client.leave('walk_30');
  assert.deepEqual(fetchImpl.calls.map(c => `${c.method} ${c.path}`), ['POST /challenges/walk_30/join', 'DELETE /challenges/walk_30']);
});

test('v2 sin conexión: error honesto, no cae a local', async () => {
  const client = createChallengesClient({
    apiUrl: 'https://api.test', token: 'tok', apiVersion: 2,
    fetchImpl: async () => { throw new TypeError('network'); }, storage: createMemoryBackend(),
  });
  await assert.rejects(client.list(), (e) => e.code === 'sin_conexion');
  assert.equal(client.mode, 'remote');
});

// ── v1 / versión desconocida → local ────────────────────────────────────────

test('versión desconocida: un 404 en /challenges pasa a modo local', async () => {
  const fetchImpl = fakeFetch({}); // v1: no existe /challenges
  const storage = createMemoryBackend();
  const client = createChallengesClient({
    apiUrl: 'https://api.test', token: 'tok', apiVersion: null, fetchImpl, storage,
  });
  const list = await client.list();
  assert.equal(client.mode, 'local');
  assert.deepEqual(list.map(c => c.key), LOCAL_CATALOG.map(c => c.key));
  // Después ya no vuelve a preguntarle al servidor.
  await client.join('gratitude_7');
  assert.equal(fetchImpl.calls.length, 1);
  assert.ok(await storage.read(CHALLENGES_STORAGE_KEY));
});

test('v1: nunca llama al servidor y usa el catálogo de la semilla', async () => {
  const fetchImpl = fakeFetch({});
  const client = createChallengesClient({
    apiUrl: 'https://api.test', token: 'tok', apiVersion: 1, fetchImpl, storage: createMemoryBackend(), lang: 'en',
  });
  const list = await client.list();
  assert.equal(fetchImpl.calls.length, 0);
  assert.equal(list.find(c => c.key === 'sleep_14').title, 'Sleep before 11pm');
  assert.ok(list.every(c => !c.joined && c.completed_days === 0), 'nada inventado');
});

test('sin API configurada: modo local', async () => {
  const client = createChallengesClient({ apiUrl: null, token: null, storage: createMemoryBackend() });
  await client.list();
  assert.equal(client.mode, 'local');
});

test('el catálogo local coincide con la semilla de la base', async () => {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(path.join(HERE, '../supabase/migrations/20260809000003_seed_challenges.sql'), 'utf8');
  for (const c of LOCAL_CATALOG) {
    assert.ok(sql.includes(`'${c.key}'`) && sql.includes(`'${c.title_es}'`) && sql.includes(`'${c.title_en}'`),
      `${c.key} no coincide con la semilla`);
    assert.match(sql, new RegExp(`'${c.key}'[^\\n]*\\b${c.total_days}\\)`));
  }
});

// ── lógica local: una vez por día, completar, abandonar ─────────────────────

test('local: registrar exige estar unido', async () => {
  const { client } = localClient();
  await assert.rejects(client.checkIn('breathing_7', at(2026, 9, 1)), (e) => e.code === 'no_unido');
});

test('local: una vez por día, con el día local', async () => {
  const { client } = localClient();
  await client.join('breathing_7');
  await client.checkIn('breathing_7', at(2026, 9, 1, 8));
  await assert.rejects(client.checkIn('breathing_7', at(2026, 9, 1, 23)),
    (e) => e.code === 'ya_registrado_hoy' && e.status === 409);
  await client.checkIn('breathing_7', at(2026, 9, 2, 0));
  const c = (await client.list(at(2026, 9, 2, 10))).find(x => x.key === 'breathing_7');
  assert.equal(c.completed_days, 2);
  assert.equal(c.checked_today, true);
  const tomorrow = (await client.list(at(2026, 9, 3, 10))).find(x => x.key === 'breathing_7');
  assert.equal(tomorrow.checked_today, false);
});

test('local: se completa al llegar al total y no acepta más días', async () => {
  const { client } = localClient();
  await client.join('gratitude_7');
  for (let d = 1; d <= 7; d++) await client.checkIn('gratitude_7', at(2026, 9, d));
  const list = await client.list(at(2026, 9, 8));
  const c = list.find(x => x.key === 'gratitude_7');
  assert.equal(c.completed_days, 7);
  assert.ok(c.completed_at, 'marca completed_at');
  assert.deepEqual(completedChallenges(list).map(x => x.key), ['gratitude_7']);
  assert.equal(activeChallenges(list).length, 0);
  await assert.rejects(client.checkIn('gratitude_7', at(2026, 9, 8)), (e) => e.code === 'ya_completado');
});

test('local: el día 6 de 7 todavía no completa', async () => {
  const { client } = localClient();
  await client.join('breathing_7');
  for (let d = 1; d <= 6; d++) await client.checkIn('breathing_7', at(2026, 9, d));
  const c = (await client.list()).find(x => x.key === 'breathing_7');
  assert.equal(c.completed_at, null);
  assert.equal(c.completed_days, 6);
});

test('local: abandonar borra el progreso; unirse de nuevo empieza de cero', async () => {
  const { client } = localClient();
  await client.join('walk_30');
  await client.checkIn('walk_30', at(2026, 9, 1));
  await client.leave('walk_30');
  let c = (await client.list()).find(x => x.key === 'walk_30');
  assert.equal(c.joined, false);
  assert.deepEqual(availableChallenges([c]).length, 1);
  await client.join('walk_30');
  c = (await client.list()).find(x => x.key === 'walk_30');
  assert.equal(c.completed_days, 0);
});

test('local: unirse dos veces no reinicia el progreso', async () => {
  const { client } = localClient();
  await client.join('sleep_14');
  await client.checkIn('sleep_14', at(2026, 9, 1));
  await client.join('sleep_14');
  assert.equal((await client.list()).find(x => x.key === 'sleep_14').completed_days, 1);
});

test('local: un guardado corrupto no rompe la pantalla', async () => {
  const storage = createMemoryBackend({ [CHALLENGES_STORAGE_KEY]: '{no es json' });
  const client = createChallengesClient({ apiUrl: null, token: null, storage });
  const list = await client.list();
  assert.equal(list.length, LOCAL_CATALOG.length);
});

// ── zonas horarias: el día es el local del cliente ──────────────────────────

function dayInZone(tz, isoInstant) {
  const mod = pathToFileURL(path.join(HERE, '../src/data/challenges.js')).href;
  const mem = pathToFileURL(path.join(HERE, '../src/data/entriesRepository.js')).href;
  const code = `
    const { createChallengesClient } = await import(${JSON.stringify(mod)});
    const { createMemoryBackend } = await import(${JSON.stringify(mem)});
    let sent = null;
    const fetchImpl = async (url, opts) => { sent = JSON.parse(opts.body).date; return { ok: true, status: 200, json: async () => ({}) }; };
    const client = createChallengesClient({ apiUrl: 'https://x.test', token: 't', apiVersion: 2, fetchImpl, storage: createMemoryBackend() });
    await client.checkIn('breathing_7', new Date(${JSON.stringify(isoInstant)}));
    process.stdout.write(sent);
  `;
  const out = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    env: { ...process.env, TZ: tz }, encoding: 'utf8',
  });
  if (out.status !== 0) throw new Error(out.stderr);
  return out.stdout.trim();
}

test('zona horaria: 10:30 p.m. en Bogotá es ese día, aunque en UTC ya sea el siguiente', () => {
  // 2026-09-24T03:30Z = 2026-09-23 22:30 en Bogotá (UTC-5)
  assert.equal(dayInZone('America/Bogota', '2026-09-24T03:30:00Z'), '2026-09-23');
});

test('zona horaria: el mismo instante en Tokio ya es el día siguiente', () => {
  // 2026-09-23T20:00Z = 2026-09-24 05:00 en Tokio (UTC+9)
  assert.equal(dayInZone('Asia/Tokyo', '2026-09-23T20:00:00Z'), '2026-09-24');
});

// ── ejercicios ──────────────────────────────────────────────────────────────

test('ejercicios: se registran con el día local y se resumen', async () => {
  const log = createExerciseLog(createMemoryBackend());
  await log.record({ kind: 'breathing', technique: 'box', seconds: 180 }, at(2026, 9, 1, 23));
  await log.record({ kind: 'breathing', technique: 'slow', seconds: 60 }, at(2026, 9, 1, 8));
  await log.record({ kind: 'grounding' }, at(2026, 9, 2));
  const list = await log.list();
  assert.equal(list[0].date, '2026-09-01');
  assert.deepEqual(summarizeExercises(list), { total: 3, breathing: 2, grounding: 1, breathingDays: 1 });
  await assert.rejects(log.record({ kind: 'yoga' }));
});

// ── logros ──────────────────────────────────────────────────────────────────

const days = (start, n) => Array.from({ length: n }, (_, i) => {
  const d = new Date(2026, 7, start + i);
  return { entryDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
});

test('logros: sin datos, todo bloqueado', () => {
  const a = computeAchievements({});
  assert.ok(a.length > 0);
  assert.ok(a.every(x => !x.unlocked && x.current === 0));
});

test('logros: racha más larga del histórico, aunque la actual se haya cortado', () => {
  const entries = [...days(1, 7), ...days(20, 2)]; // 7 seguidos, hueco, 2
  assert.equal(longestStreak(entries), 7);
  const a = computeAchievements({ streak: 2, entries });
  assert.equal(a.find(x => x.id === 'streak_7').unlocked, true);
  assert.equal(a.find(x => x.id === 'streak_30').unlocked, false);
  assert.equal(a.find(x => x.id === 'streak_30').current, 7);
  assert.equal(a.find(x => x.id === 'first_checkin').unlocked, true);
});

test('logros: acepta entradas del servidor (entry_date) y cruza meses', () => {
  const entries = [{ entry_date: '2026-08-31' }, { entry_date: '2026-09-01' }];
  assert.equal(longestStreak(entries), 2);
});

test('logros: retos completados y ejercicios cuentan solo si existen', () => {
  const challenges = [
    { key: 'a', completed_at: '2026-09-01T00:00:00Z' },
    { key: 'b', completed_at: null, joined: true },
  ];
  const exercises = Array.from({ length: 10 }, () => ({ kind: 'breathing' }));
  const a = computeAchievements({ challenges, exercises });
  assert.equal(a.find(x => x.id === 'first_challenge').unlocked, true);
  assert.equal(a.find(x => x.id === 'challenges_3').unlocked, false);
  assert.equal(a.find(x => x.id === 'challenges_3').current, 1);
  assert.equal(a.find(x => x.id === 'exercises_10').unlocked, true);
});
