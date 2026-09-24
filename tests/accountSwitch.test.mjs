// Cambio de cuenta en el mismo teléfono: el diario de una cuenta nunca se sube
// con el token de otra, y lo escrito sin sesión no se adopta sin preguntar.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { tokenSubject, trustedCachedProfile, persistNewSession, adoptionPrompt } from '../src/lib/accountSwitch.js';

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (payload) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.firma`;

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

test('tokenSubject lee el sub del JWT sin dependencias, y tolera basura', () => {
  assert.equal(tokenSubject(jwt({ sub: A, iat: 1 })), A);
  // Con caracteres que en base64url salen como - y _ .
  assert.equal(tokenSubject(jwt({ sub: B, n: 'ñ??>>~' })), B);
  for (const bad of [null, undefined, '', 'x', 'a.b', 'a.@@@.c', jwt({ nope: 1 }), `${b64url({})}.bm8gZXMganNvbg.x`]) {
    assert.equal(tokenSubject(bad), null, String(bad));
  }
});

test('al arrancar, el perfil en caché solo vale si es del dueño del token', () => {
  const perfilA = { id: A, display_name: 'A' };
  assert.equal(trustedCachedProfile(jwt({ sub: A }), perfilA), perfilA);
  // Escenario del hallazgo: 401 de A → B entra → /auth/me no responde → token
  // de B con la caché de A. No se debe abrir el diario de A con el token de B.
  assert.equal(trustedCachedProfile(jwt({ sub: B }), perfilA), null);
  assert.equal(trustedCachedProfile('no-es-un-jwt', perfilA), null);
  assert.equal(trustedCachedProfile(null, perfilA), null);
  assert.equal(trustedCachedProfile(jwt({ sub: A }), null), null);
});

test('un login nuevo guarda el token y borra el perfil en caché de la sesión anterior', async () => {
  const mem = new Map([['raiz.profile.v1', JSON.stringify({ id: A })], ['raiz.session.v1', 'viejo']]);
  const storage = {
    setItem: async (k, v) => { mem.set(k, v); },
    removeItem: async (k) => { mem.delete(k); },
  };
  await persistNewSession(storage, { sessionKey: 'raiz.session.v1', profileKey: 'raiz.profile.v1' }, 'token-de-b');
  assert.equal(mem.get('raiz.session.v1'), 'token-de-b');
  assert.equal(mem.has('raiz.profile.v1'), false);
});

test('adoptar lo escrito sin sesión: se pregunta con el conteo, y un "no" se recuerda', () => {
  const guest = {
    entries: [{ entryDate: '2026-09-01', updatedAt: '2026-09-01T10:00:00.000Z' }],
    journal: [{ id: 'j1', updatedAt: '2026-09-02T10:00:00.000Z' }, { id: 'j2', createdAt: '2026-08-01T00:00:00.000Z' }],
  };
  const first = adoptionPrompt(guest, {}, A);
  assert.equal(first.ask, true);
  assert.equal(first.count, 3);

  // Dijo que no: no se vuelve a preguntar por lo mismo…
  const declined = { [A]: first.signature };
  assert.equal(adoptionPrompt(guest, declined, A).ask, false);
  // …pero otra cuenta sí recibe la pregunta, y si hay algo nuevo, también.
  assert.equal(adoptionPrompt(guest, declined, B).ask, true);
  const more = { ...guest, journal: [...guest.journal, { id: 'j3', updatedAt: '2026-09-03T10:00:00.000Z' }] };
  assert.equal(adoptionPrompt(more, declined, A).ask, true);

  assert.equal(adoptionPrompt({ entries: [], journal: [] }, {}, A).ask, false, 'sin nada, no se pregunta');
});
