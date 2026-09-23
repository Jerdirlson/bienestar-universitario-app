// Pruebas del diario local-first: validación del diario libre, almacén por
// usuario, cola, sincronización contra un servidor falso (fetch simulado),
// conflictos, v1, sin conexión, 401 y cierre de sesión.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { uuidv4, isUuid } from '../src/lib/uuid.js';
import { normalizeJournal, JOURNAL_BODY_MAX } from '../src/data/journal.js';
import { InvalidEntryError } from '../src/data/entry.js';
import { createMemoryBackend, STORAGE_KEY as LEGACY_KEY } from '../src/data/entriesRepository.js';
import { createDiaryStore, storageKeysFor } from '../src/data/diaryStore.js';
import { createDiaryApi, fromServerEntry } from '../src/data/diaryApi.js';
import { createSyncEngine } from '../src/data/diarySync.js';

const T0 = new Date('2026-09-20T15:00:00.000Z');
const clock = (start = T0) => {
  let t = start.getTime();
  const now = () => new Date(t);
  now.advance = (ms) => { t += ms; };
  return now;
};

// ── servidor falso v2 ────────────────────────────────────────────────────────

function fakeServer({ version = 2, token = 'tok' } = {}) {
  const srv = {
    version,
    token,
    offline: false,
    failNext: null, // { status, error } para la próxima petición
    entries: new Map(),
    journal: new Map(),
    calls: [],
    t: Date.parse('2026-09-20T16:00:00.000Z'),
  };
  srv.tick = () => new Date((srv.t += 1000)).toISOString();

  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

  srv.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const path = url.replace('https://api.test', '');
    srv.calls.push(`${method} ${path}`);
    if (srv.offline) throw new TypeError('Network request failed');
    if (srv.failNext) { const f = srv.failNext; srv.failNext = null; return json(f.status, { error: f.error }); }

    if (path === '/meta') return srv.version >= 2 ? json(200, { api_version: srv.version }) : json(404, { error: 'not_found' });
    if (srv.version < 2) return json(404, { error: 'not_found' });
    if (init.headers?.authorization !== `Bearer ${srv.token}`) return json(401, { error: 'sesion_invalida' });

    const body = init.body ? JSON.parse(init.body) : {};
    let m;
    if (path === '/entries' && method === 'GET') {
      return json(200, { entries: [...srv.entries.values()].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1)) });
    }
    if ((m = path.match(/^\/entries\/(\d{4}-\d{2}-\d{2})$/))) {
      const d = m[1];
      if (method === 'PUT') {
        if (!Number.isInteger(body.mood) || body.mood < 0 || body.mood > 4) return json(400, { error: 'entrada_invalida' });
        const prev = srv.entries.get(d);
        const now = srv.tick();
        const e = { entry_date: d, mood: body.mood, feelings: body.feelings ?? [], causes: body.causes ?? [], note: body.note ?? '', created_at: prev?.created_at ?? now, updated_at: now };
        srv.entries.set(d, e);
        return json(200, { entry: e });
      }
      if (method === 'DELETE') { srv.entries.delete(d); return json(200, { ok: true }); }
    }
    if (path === '/journal' && method === 'GET') {
      return json(200, { entries: [...srv.journal.values()] });
    }
    if ((m = path.match(/^\/journal\/([0-9a-f-]{36})$/))) {
      const id = m[1];
      if (method === 'PUT') {
        if (typeof body.body !== 'string' || body.body.length < 1 || body.body.length > 10000) return json(400, { error: 'entrada_invalida' });
        const prev = srv.journal.get(id);
        const now = srv.tick();
        const j = { id, title: body.title ?? '', body: body.body, prompt_key: body.promptKey ?? null, mood: body.mood ?? null, created_at: prev?.created_at ?? body.createdAt ?? now, updated_at: now };
        srv.journal.set(id, j);
        return json(200, { entry: j });
      }
      if (method === 'DELETE') { srv.journal.delete(id); return json(200, { ok: true }); }
    }
    return json(404, { error: 'not_found' });
  };
  return srv;
}

// Arma teléfono + servidor. Los temporizadores se capturan para probar el backoff.
function setup({ server = fakeServer(), storage = createMemoryBackend(), ns = 'user-1', token = 'tok', now = clock() } = {}) {
  const store = createDiaryStore(storage, ns, { now });
  const api = createDiaryApi({ baseUrl: 'https://api.test', fetch: server.fetch });
  const timers = [];
  const ctx = { token, store };
  const states = [];
  const engine = createSyncEngine({
    api,
    getStore: () => ctx.store,
    getToken: () => ctx.token,
    onChange: (s) => states.push(s.status),
    now: () => now().getTime(),
    setTimer: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t; },
    clearTimer: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); },
    random: () => 0.5,
  });
  return { server, storage, store, api, engine, ctx, timers, states, now };
}

// ── uuid y validación del diario libre ───────────────────────────────────────

test('uuidv4 genera ids v4 válidos y distintos', () => {
  const ids = new Set(Array.from({ length: 200 }, () => uuidv4()));
  assert.equal(ids.size, 200);
  for (const id of ids) {
    assert.ok(isUuid(id), id);
    assert.equal(id[14], '4');
    assert.ok('89ab'.includes(id[19]));
  }
});

test('uuidv4 funciona sin crypto (solo Math.random)', () => {
  const id = uuidv4((n) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256)));
  assert.ok(isUuid(id));
});

test('normalizeJournal aplica las reglas de la base', () => {
  const j = normalizeJournal({ body: '  hola  ', title: ' Título ' }, T0);
  assert.ok(isUuid(j.id));
  assert.equal(j.body, 'hola');
  assert.equal(j.title, 'Título');
  assert.equal(j.mood, null);
  assert.equal(j.promptKey, null);
  assert.equal(j.createdAt, T0.toISOString());

  for (const bad of [
    { body: '' },
    { body: '   ' },
    { body: 'x'.repeat(JOURNAL_BODY_MAX + 1) },
    { body: 'ok', title: 'x'.repeat(121) },
    { body: 'ok', mood: 5 },
    { body: 'ok', mood: 2.5 },
    { body: 'ok', promptKey: 'x'.repeat(41) },
    { body: 'ok', id: 'no-es-uuid' },
  ]) {
    assert.throws(() => normalizeJournal(bad, T0), InvalidEntryError, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal(normalizeJournal({ body: 'x'.repeat(JOURNAL_BODY_MAX) }, T0).body.length, JOURNAL_BODY_MAX);
});

// ── almacén local ────────────────────────────────────────────────────────────

test('guardar es inmediato y queda en la cola', async () => {
  const { store } = setup();
  await store.load();
  await store.saveEntry({ mood: 3, entryDate: '2026-09-20', feelings: ['tranquilo'] });
  const j = await store.saveJournal({ body: 'Hoy fue un buen día', promptKey: 'gratitude' });
  const snap = store.getSnapshot();
  assert.equal(snap.entries.length, 1);
  assert.equal(snap.journal[0].id, j.id);
  assert.equal(snap.pending, 2);
  assert.equal(snap.entries[0]._srv, undefined, 'lo interno no sale a la UI');
});

test('el almacén sobrevive a reabrir la app', async () => {
  const storage = createMemoryBackend();
  const a = createDiaryStore(storage, 'u1');
  await a.load();
  await a.saveEntry({ mood: 2, entryDate: '2026-09-19' });
  await a.saveJournal({ body: 'nota' });
  const b = createDiaryStore(storage, 'u1');
  await b.load();
  assert.equal(b.getSnapshot().entries.length, 1);
  assert.equal(b.getSnapshot().journal.length, 1);
  assert.equal(b.getSnapshot().pending, 2);
});

test('cada usuario tiene su propio espacio en el teléfono', async () => {
  const storage = createMemoryBackend();
  const a = createDiaryStore(storage, 'ana');
  await a.load();
  await a.saveJournal({ body: 'secreto de Ana' });
  const b = createDiaryStore(storage, 'beto');
  await b.load();
  assert.deepEqual(b.getSnapshot().journal, []);
  assert.deepEqual(b.getSnapshot().entries, []);
});

test('editar conserva createdAt; varias ediciones son una sola operación', async () => {
  const now = clock();
  const store = createDiaryStore(createMemoryBackend(), 'u', { now });
  await store.load();
  const first = await store.saveJournal({ body: 'uno' });
  now.advance(60_000);
  const second = await store.saveJournal({ id: first.id, body: 'dos' });
  assert.equal(second.createdAt, first.createdAt);
  assert.notEqual(second.updatedAt, first.updatedAt);
  assert.equal(store.pendingCount(), 1);
  assert.equal(store.getSnapshot().journal[0].body, 'dos');
});

test('borrar quita el registro y encola el borrado', async () => {
  const store = createDiaryStore(createMemoryBackend(), 'u');
  await store.load();
  await store.saveEntry({ mood: 1, entryDate: '2026-09-18' });
  assert.equal(await store.deleteEntry('2026-09-18'), true);
  assert.deepEqual(store.getSnapshot().entries, []);
  assert.deepEqual(store.pendingOps().map((o) => o.kind), ['delete']);
  assert.equal(await store.deleteEntry('2026-01-01'), false, 'borrar lo que no existe no encola nada');
});

test('un guardado inválido no toca lo que ya había', async () => {
  const store = createDiaryStore(createMemoryBackend(), 'u');
  await store.load();
  await store.saveJournal({ body: 'bien' });
  await assert.rejects(() => store.saveJournal({ body: '' }), InvalidEntryError);
  await assert.rejects(() => store.saveEntry({ mood: 9 }), InvalidEntryError);
  assert.equal(store.getSnapshot().journal.length, 1);
  assert.equal(store.pendingCount(), 1);
});

test('migra el histórico anterior (raiz.entries.v1) y lo deja pendiente de subir', async () => {
  const legacy = [
    { entryDate: '2026-08-01', mood: 3, feelings: ['feliz'], causes: [], note: 'viejo', createdAt: '2026-08-01T12:00:00.000Z', updatedAt: '2026-08-01T12:00:00.000Z' },
    { entryDate: 'mal', mood: 3 },
  ];
  const storage = createMemoryBackend({ [LEGACY_KEY]: JSON.stringify(legacy) });
  const store = createDiaryStore(storage, 'u');
  await store.load();
  const snap = store.getSnapshot();
  assert.equal(snap.entries.length, 1, 'lo inválido se ignora sin romper');
  assert.equal(snap.entries[0].note, 'viejo');
  assert.equal(snap.entries[0].createdAt, '2026-08-01T12:00:00.000Z');
  assert.equal(snap.pending, 1);
  assert.equal(await storage.read(LEGACY_KEY), null, 'la clave vieja se retira');
});

test('un guardado corrupto no rompe el diario', async () => {
  const keys = storageKeysFor('u');
  const storage = createMemoryBackend({ [keys.entries]: '{no', [keys.journal]: 'null', [keys.queue]: '[[' });
  const store = createDiaryStore(storage, 'u');
  await store.load();
  assert.deepEqual(store.getSnapshot().entries, []);
  await store.saveJournal({ body: 'sigue funcionando' });
  assert.equal(store.getSnapshot().journal.length, 1);
});

test('borradores: se guardan, se leen y se borran', async () => {
  const store = createDiaryStore(createMemoryBackend(), 'u');
  await store.load();
  await store.setDraft('new:gratitude', { title: '', body: '1. café' });
  assert.equal(store.getDraft('new:gratitude').body, '1. café');
  await store.setDraft('new:gratitude', null);
  assert.equal(store.getDraft('new:gratitude'), null);
});

test('lo escrito sin sesión pasa a la cuenta al iniciar sesión', async () => {
  const storage = createMemoryBackend();
  const guest = createDiaryStore(storage, 'guest');
  await guest.load();
  await guest.saveJournal({ body: 'antes del login' });
  const user = createDiaryStore(storage, 'u1');
  await user.load();
  assert.equal(await user.adoptFrom(guest), 1);
  assert.equal(user.getSnapshot().journal[0].body, 'antes del login');
  assert.equal(user.pendingCount(), 1);
  const again = createDiaryStore(storage, 'guest');
  await again.load();
  assert.deepEqual(again.getSnapshot().journal, [], 'el espacio sin sesión queda vacío');
});

test('wipe borra todo, o conserva solo lo que falta subir', async () => {
  const storage = createMemoryBackend();
  const { store, engine, server } = setup({ storage });
  await store.load();
  await store.saveJournal({ body: 'subida' });
  await engine.sync();
  await store.saveJournal({ body: 'sin subir' });
  server.offline = true;

  assert.equal(await store.wipe({ keepPending: true }), 1);
  assert.deepEqual(store.getSnapshot().journal.map((j) => j.body), ['sin subir']);

  assert.equal(await store.wipe({ keepPending: false }), 0);
  const reopened = createDiaryStore(storage, 'user-1');
  await reopened.load();
  assert.deepEqual(reopened.getSnapshot().journal, []);
  assert.equal(reopened.pendingCount(), 0);
});

// ── cliente HTTP ─────────────────────────────────────────────────────────────

test('fromServerEntry traduce snake_case y tolera nulos', () => {
  const e = fromServerEntry({ entry_date: '2026-09-01', mood: 2, feelings: null, causes: ['estudios'], note: null, created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z' });
  assert.deepEqual(e, { entryDate: '2026-09-01', mood: 2, feelings: [], causes: ['estudios'], note: '', createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' });
});

test('getApiVersion: 2 con /meta, 1 si /meta no existe, error sin conexión', async () => {
  const s2 = fakeServer();
  assert.equal(await createDiaryApi({ baseUrl: 'https://api.test', fetch: s2.fetch }).getApiVersion(), 2);
  const s1 = fakeServer({ version: 1 });
  assert.equal(await createDiaryApi({ baseUrl: 'https://api.test', fetch: s1.fetch }).getApiVersion(), 1);
  s1.offline = true;
  await assert.rejects(() => createDiaryApi({ baseUrl: 'https://api.test', fetch: s1.fetch }).getApiVersion());
});

// ── sincronización ───────────────────────────────────────────────────────────

test('primera sincronización: sube el histórico local y queda al día', async () => {
  const storage = createMemoryBackend({ [LEGACY_KEY]: JSON.stringify([{ entryDate: '2026-08-01', mood: 4, note: 'antes' }]) });
  const { store, engine, server } = setup({ storage });
  await store.load();
  await store.saveJournal({ body: 'nuevo' });
  await engine.sync({ reason: 'start' });
  assert.equal(engine.getState().status, 'synced');
  assert.equal(server.entries.get('2026-08-01').note, 'antes');
  assert.equal(server.journal.size, 1);
  assert.equal(store.pendingCount(), 0);
  // el registro local adopta la marca de tiempo del servidor
  assert.equal(store.getSnapshot().entries[0].updatedAt, server.entries.get('2026-08-01').updated_at);
});

test('al iniciar sesión descarga todo lo del servidor', async () => {
  const server = fakeServer();
  server.entries.set('2026-09-01', { entry_date: '2026-09-01', mood: 1, feelings: ['tranquilo'], causes: [], note: 'del otro teléfono', created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z' });
  const id = uuidv4();
  server.journal.set(id, { id, title: 'T', body: 'B', prompt_key: 'free', mood: 3, created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z' });
  const { store, engine } = setup({ server });
  await store.load();
  await engine.sync({ reason: 'login' });
  const snap = store.getSnapshot();
  assert.equal(snap.entries[0].note, 'del otro teléfono');
  assert.equal(snap.journal[0].promptKey, 'free');
  assert.equal(snap.pending, 0);
});

test('servidor v1: no se intenta sincronizar y nada se pierde', async () => {
  const server = fakeServer({ version: 1 });
  const { store, engine, timers } = setup({ server });
  await store.load();
  await store.saveEntry({ mood: 2, entryDate: '2026-09-20' });
  await engine.sync();
  assert.equal(engine.getState().status, 'unsupported');
  assert.equal(engine.getState().apiVersion, 1);
  assert.ok(!server.calls.some((c) => c.includes('/entries')), 'no toca /entries');
  assert.equal(timers.length, 0, 'no reintenta en bucle');
  assert.equal(store.pendingCount(), 1);

  // el servidor se actualiza: al volver a primer plano se sincroniza
  server.version = 2;
  await engine.sync({ reason: 'foreground' });
  assert.equal(engine.getState().status, 'synced');
  assert.equal(server.entries.size, 1);
});

test('sin conexión: queda en el teléfono y reintenta con espera creciente', async () => {
  const server = fakeServer();
  server.offline = true;
  const { store, engine, timers } = setup({ server });
  await store.load();
  await store.saveJournal({ body: 'offline' });
  await engine.sync();
  assert.equal(engine.getState().status, 'offline');
  assert.equal(timers.length, 1);
  const first = timers[0].ms;

  const fire = () => timers.shift().fn();
  await fire();
  assert.equal(timers.length, 1, 'un solo temporizador a la vez');
  const second = timers[0].ms;
  assert.ok(second > first, `backoff: ${second} > ${first}`);
  await fire();
  assert.ok(timers[0].ms > second);

  server.offline = false;
  await fire();
  assert.equal(engine.getState().status, 'synced');
  assert.equal(timers.length, 0, 'al recuperarse deja de reintentar');
  assert.equal(server.journal.size, 1);
});

test('401 (sesión vencida): se detiene y no borra nada', async () => {
  const { store, engine, ctx, timers, server } = setup({ token: 'vencido' });
  await store.load();
  await store.saveEntry({ mood: 3, entryDate: '2026-09-20', note: 'importante' });
  await engine.sync();
  assert.equal(engine.getState().status, 'auth');
  assert.equal(timers.length, 0);
  assert.equal(store.getSnapshot().entries[0].note, 'importante');
  assert.equal(store.pendingCount(), 1);

  ctx.token = 'tok'; // vuelve a iniciar sesión
  await engine.sync({ reason: 'login' });
  assert.equal(engine.getState().status, 'synced');
  assert.equal(server.entries.get('2026-09-20').note, 'importante');
});

test('conflicto: el cambio más reciente gana (servidor más nuevo)', async () => {
  const now = clock(new Date('2026-09-20T15:00:00.000Z'));
  const { store, engine, server } = setup({ now });
  await store.load();
  await store.saveEntry({ mood: 1, entryDate: '2026-09-20', note: 'v1' });
  await engine.sync();

  // offline, este teléfono edita a las 15:00…
  server.offline = true;
  await store.saveEntry({ mood: 2, entryDate: '2026-09-20', note: 'teléfono (viejo)' });
  // …y otro teléfono edita después (el servidor queda con una hora posterior)
  server.entries.set('2026-09-20', { ...server.entries.get('2026-09-20'), note: 'otro teléfono (nuevo)', updated_at: '2026-09-20T18:00:00.000Z' });

  server.offline = false;
  await engine.sync();
  assert.equal(store.getSnapshot().entries[0].note, 'otro teléfono (nuevo)');
  assert.equal(server.entries.get('2026-09-20').note, 'otro teléfono (nuevo)');
  assert.equal(store.pendingCount(), 0);
});

test('conflicto: el cambio local más reciente gana y se sube', async () => {
  const now = clock(new Date('2026-09-20T20:00:00.000Z'));
  const { store, engine, server } = setup({ now });
  const id = uuidv4();
  server.journal.set(id, { id, title: '', body: 'servidor', prompt_key: null, mood: null, created_at: '2026-09-20T10:00:00.000Z', updated_at: '2026-09-20T10:00:00.000Z' });
  await store.load();
  await engine.sync();
  server.offline = true;
  await store.saveJournal({ id, body: 'local' });
  // otro teléfono editó antes de nuestra edición local
  server.journal.set(id, { ...server.journal.get(id), body: 'otro, más viejo', updated_at: '2026-09-20T12:00:00.000Z' });
  server.offline = false;
  await engine.sync();
  assert.equal(server.journal.get(id).body, 'local');
  assert.equal(store.getSnapshot().journal[0].body, 'local');
});

test('un cambio local sobre la versión vigente gana aunque el reloj del teléfono esté atrasado', async () => {
  // teléfono con la hora de hace un año
  const now = clock(new Date('2025-09-20T10:00:00.000Z'));
  const { store, engine, server } = setup({ now });
  await store.load();
  await store.saveEntry({ mood: 1, entryDate: '2026-09-20', note: 'a' });
  await engine.sync();
  await store.saveEntry({ mood: 4, entryDate: '2026-09-20', note: 'b' });
  await engine.sync();
  assert.equal(server.entries.get('2026-09-20').note, 'b');
});

test('los cambios pendientes no se pierden al bajar la lista del servidor', async () => {
  const { store, engine, server } = setup();
  await store.load();
  server.failNext = null;
  await store.saveJournal({ body: 'escrito offline' });
  // el servidor no lo tiene todavía: bajar la lista no debe borrarlo
  const list = await createDiaryApi({ baseUrl: 'https://api.test', fetch: server.fetch }).listJournal('tok');
  await store.applyServerSnapshot('journal', list);
  assert.equal(store.getSnapshot().journal.length, 1);
  assert.equal(store.pendingCount(), 1);
  await engine.sync();
  assert.equal(server.journal.size, 1);
});

test('borrados: se propagan en ambos sentidos', async () => {
  const { store, engine, server } = setup();
  await store.load();
  const a = await store.saveJournal({ body: 'a' });
  const b = await store.saveJournal({ body: 'b' });
  await store.saveEntry({ mood: 2, entryDate: '2026-09-19' });
  await engine.sync();
  assert.equal(server.journal.size, 2);

  // borrado local → servidor
  await store.deleteJournal(a.id);
  await store.deleteEntry('2026-09-19');
  await engine.sync();
  assert.equal(server.journal.has(a.id), false);
  assert.equal(server.entries.size, 0);

  // borrado desde otro teléfono → local
  server.journal.delete(b.id);
  await engine.sync();
  assert.deepEqual(store.getSnapshot().journal, []);
});

test('borrar sin conexión algo recién creado también se propaga', async () => {
  const { store, engine, server } = setup();
  await store.load();
  const j = await store.saveJournal({ body: 'efímera' });
  await store.deleteJournal(j.id);
  await engine.sync();
  assert.equal(server.journal.size, 0);
  assert.equal(store.pendingCount(), 0);
});

test('una edición durante la subida no se pierde', async () => {
  const server = fakeServer();
  const { store, engine } = setup({ server });
  await store.load();
  const j = await store.saveJournal({ body: 'primera' });
  // edita justo cuando el PUT está en vuelo
  const realFetch = server.fetch;
  let edited = false;
  server.fetch = async (url, init) => {
    const res = await realFetch(url, init);
    if (!edited && init?.method === 'PUT') { edited = true; await store.saveJournal({ id: j.id, body: 'segunda' }); }
    return res;
  };
  const api = createDiaryApi({ baseUrl: 'https://api.test', fetch: server.fetch });
  const engine2 = createSyncEngine({ api, getStore: () => store, getToken: () => 'tok', setTimer: () => null, clearTimer: () => {} });
  await engine2.sync();
  assert.equal(store.getSnapshot().journal[0].body, 'segunda', 'la edición local se conserva');
  assert.equal(store.pendingCount(), 1, 'y sigue pendiente');
  await engine2.sync();
  assert.equal(server.journal.get(j.id).body, 'segunda');
  assert.equal(store.pendingCount(), 0);
  void engine;
});

test('una operación que el servidor rechaza no bloquea las demás ni se pierde', async () => {
  const server = fakeServer();
  const { store, engine } = setup({ server });
  await store.load();
  await store.saveEntry({ mood: 3, entryDate: '2026-09-18' });
  await store.saveJournal({ body: 'ok' });
  server.failNext = null;
  const realFetch = server.fetch;
  server.fetch = async (url, init) => (init?.method === 'PUT' && url.includes('/entries/') ? { ok: false, status: 400, json: async () => ({ error: 'entrada_invalida' }) } : realFetch(url, init));
  const api = createDiaryApi({ baseUrl: 'https://api.test', fetch: server.fetch });
  const e2 = createSyncEngine({ api, getStore: () => store, getToken: () => 'tok', setTimer: () => null, clearTimer: () => {} });
  await e2.sync();
  assert.equal(server.journal.size, 1, 'lo demás se sube');
  assert.equal(store.getSnapshot().entries.length, 1, 'el rechazado sigue en el teléfono');
  assert.equal(store.getSnapshot().rejected, 1);
  assert.equal(store.pendingCount(), 0, 'no se reintenta en bucle');
  void engine;
});

test('sin sesión o sin servidor configurado: estado local, sin red', async () => {
  const { store, engine, ctx, server } = setup();
  ctx.token = null;
  await store.load();
  await store.saveJournal({ body: 'x' });
  await engine.sync();
  assert.equal(engine.getState().status, 'local');
  assert.ok(!server.calls.some((c) => c.includes('/journal')));

  const noUrl = createSyncEngine({ api: createDiaryApi({ baseUrl: null }), getStore: () => store, getToken: () => 'tok' });
  await noUrl.sync();
  assert.equal(noUrl.getState().status, 'local');
});

test('cerrar sesión: sube lo pendiente y luego borra el diario del teléfono', async () => {
  const storage = createMemoryBackend();
  const { store, engine, server } = setup({ storage });
  await store.load();
  await store.saveJournal({ body: 'antes de salir' });
  await engine.flush(1000);
  assert.equal(server.journal.size, 1);
  assert.equal(await store.wipe({ keepPending: true }), 0);
  const reopened = createDiaryStore(storage, 'user-1');
  await reopened.load();
  assert.deepEqual(reopened.getSnapshot().journal, []);
  assert.equal(server.journal.size, 1, 'sigue a salvo en la cuenta');
});

test('cerrar sesión sin conexión: lo no subido se conserva para la próxima vez', async () => {
  const storage = createMemoryBackend();
  const server = fakeServer();
  server.offline = true;
  const { store, engine } = setup({ storage, server });
  await store.load();
  await store.saveJournal({ body: 'no se puede perder' });
  await engine.flush(1000);
  assert.equal(await store.wipe({ keepPending: true }), 1);

  // la misma persona vuelve a entrar con conexión
  server.offline = false;
  const back = setup({ storage, server });
  await back.store.load();
  assert.equal(back.store.getSnapshot().journal[0].body, 'no se puede perder');
  await back.engine.sync({ reason: 'login' });
  assert.equal(server.journal.size, 1);
});

test('si cambia la cuenta durante una sincronización, no mezcla datos', async () => {
  const storage = createMemoryBackend();
  const server = fakeServer();
  const id = uuidv4();
  server.journal.set(id, { id, title: '', body: 'de la cuenta A', prompt_key: null, mood: null, created_at: T0.toISOString(), updated_at: T0.toISOString() });
  const a = createDiaryStore(storage, 'A');
  const b = createDiaryStore(storage, 'B');
  await a.load(); await b.load();
  const ctx = { store: a, token: 'tok' };
  const realFetch = server.fetch;
  server.fetch = async (url, init) => {
    const res = await realFetch(url, init);
    if (url.endsWith('/journal')) { ctx.store = b; ctx.token = null; }
    return res;
  };
  const engine = createSyncEngine({ api: createDiaryApi({ baseUrl: 'https://api.test', fetch: server.fetch }), getStore: () => ctx.store, getToken: () => ctx.token, setTimer: () => null, clearTimer: () => {} });
  await engine.sync();
  assert.deepEqual(b.getSnapshot().journal, [], 'B no recibe lo de A');
  assert.deepEqual(a.getSnapshot().journal, [], 'A no aplica una respuesta que llegó después del cambio');
  assert.equal(engine.getState().status, 'local');
});
