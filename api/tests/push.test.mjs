// Pruebas de notificaciones push (api/src/push.js): texto genérico (nunca el
// contenido de lo que pasó), el interruptor por usuario, y la limpieza de
// tokens que Expo reporta como DeviceNotRegistered.
//
// El fetch a la Expo real se mockea con __setFetchForTests — nunca debe
// pegarle a la red desde las pruebas. Se dispara a través del mismo camino
// real que en producción: un trigger de Postgres (ver
// supabase/migrations/20260928000002_push_and_realtime.sql) avisa por
// LISTEN/NOTIFY a api/src/realtime.js, que llama a sendPushForNotification.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './helpers.mjs';
import { attachRealtime, stopEventListener } from '../src/realtime.js';
import { __setFetchForTests } from '../src/push.js';

let ctx;
let calls;

function mockFetch(ticketFor = () => ({ status: 'ok' })) {
  return async (url, opts) => {
    const messages = JSON.parse(opts.body);
    calls.push({ url, messages });
    return { json: async () => ({ data: messages.map((m) => ticketFor(m)) }) };
  };
}

before(async () => {
  ctx = await startApi();
  attachRealtime(ctx.server);
  await new Promise((r) => setTimeout(r, 300));
});

beforeEach(() => {
  calls = [];
  __setFetchForTests(mockFetch());
});

after(async () => {
  __setFetchForTests(null);
  await stopEventListener();
  await ctx.stop();
});

/** Espera activa a que llegue al menos una llamada mockeada, o falla. */
async function waitForCall(timeoutMs = 3000) {
  const start = Date.now();
  while (calls.length === 0) {
    if (Date.now() - start > timeoutMs) throw new Error('no llegó ninguna llamada a Expo');
    await new Promise((r) => setTimeout(r, 30));
  }
  return calls[0];
}

test('una reacción manda un push con texto genérico, sin excerpt ni actor', async () => {
  const ana = await ctx.cuenta('push-ana@upb.edu.co');
  const beto = await ctx.cuenta('push-beto@upb.edu.co');

  await ctx.call('POST', '/me/push-token', ana.token, { token: 'ExponentPushToken[ana-device]' });
  const post = (await ctx.call('POST', '/posts', ana.token, { body: 'un texto cualquiera del post' })).body.post;

  await ctx.call('POST', `/posts/${post.id}/react`, beto.token, { kind: 'fuerza' });

  const call = await waitForCall();
  assert.equal(call.messages.length, 1);
  const [msg] = call.messages;
  assert.equal(msg.to, 'ExponentPushToken[ana-device]');
  assert.equal(msg.body, 'Alguien reaccionó a tu publicación.');
  assert.equal(msg.data.kind, 'post_reaction');
  const serialized = JSON.stringify(msg);
  assert.ok(!serialized.includes('un texto cualquiera del post'), 'no debe llevar el contenido del post');
  assert.ok(!serialized.includes(beto.id), 'no debe identificar a quien reaccionó');
});

test('con el interruptor de push apagado, no se manda nada', async () => {
  const ana = await ctx.cuenta('push-off-ana@upb.edu.co');
  const beto = await ctx.cuenta('push-off-beto@upb.edu.co');

  await ctx.call('POST', '/me/push-token', ana.token, { token: 'ExponentPushToken[ana-off]' });
  const offResp = await ctx.call('PUT', '/me/push-settings', ana.token, { enabled: false });
  assert.equal(offResp.status, 200);

  const post = (await ctx.call('POST', '/posts', ana.token, { body: 'otro post cualquiera' })).body.post;
  await ctx.call('POST', `/posts/${post.id}/react`, beto.token, { kind: 'abrazo' });

  // Ventana de gracia: si algo se fuera a mandar, ya habría llegado.
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(calls.length, 0, 'no debería haberse llamado a Expo con el interruptor apagado');
});

test('un token que Expo marca DeviceNotRegistered se borra', async () => {
  const ana = await ctx.cuenta('push-invalido-ana@upb.edu.co');
  const beto = await ctx.cuenta('push-invalido-beto@upb.edu.co');

  await ctx.call('POST', '/me/push-token', ana.token, { token: 'ExponentPushToken[ana-muerto]' });
  __setFetchForTests(mockFetch(() => ({ status: 'error', details: { error: 'DeviceNotRegistered' } })));

  const post = (await ctx.call('POST', '/posts', ana.token, { body: 'post que dispara el push fallido' })).body.post;
  await ctx.call('POST', `/posts/${post.id}/react`, beto.token, { kind: 'inspira' });

  await waitForCall();
  // Da tiempo a que push.js borre el token después de leer la respuesta.
  await new Promise((r) => setTimeout(r, 400));

  const { rows } = await ctx.owner.query(
    "select 1 from public.push_tokens where user_id = $1 and token = 'ExponentPushToken[ana-muerto]'",
    [ana.id]
  );
  assert.equal(rows.length, 0, 'el token inválido debería haberse borrado');
});
