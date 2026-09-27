// Pruebas del canal /ws (api/src/realtime.js): autenticación, entrega SOLO al
// destinatario correcto, y sin ningún contenido en el mensaje del socket —
// mismo principio que /admin/ws (avisa, el cliente vuelve a pedir por HTTP).
//
// A diferencia de las demás pruebas del API, aquí SÍ hace falta el servidor
// HTTP real (no solo app.listen(0) de helpers.startApi): las WebSocketServer
// se cuelgan del evento 'upgrade' del http.Server, así que se llama
// attachRealtime(server) sobre el mismo server que ya crea startApi().
//
// El fetch de Expo se mockea (no debe pegarle a la red real desde las
// pruebas) y se ignora su resultado: lo que push.js hace con eso lo cubre
// push.test.mjs.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startApi } from './helpers.mjs';
import { attachRealtime, stopEventListener } from '../src/realtime.js';
import { __setFetchForTests } from '../src/push.js';

let ctx;

before(async () => {
  ctx = await startApi();
  attachRealtime(ctx.server);
  // Da tiempo a que la conexión LISTEN dedicada termine de conectarse antes
  // de que las pruebas empiecen a insertar filas.
  __setFetchForTests(async () => ({ json: async () => ({ data: [] }) }));
  await new Promise((r) => setTimeout(r, 300));
});

after(async () => {
  __setFetchForTests(null);
  await stopEventListener();
  await ctx.stop();
});

const wsBase = () => ctx.base.replace(/^http/, 'ws');

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${wsBase()}/ws?token=${encodeURIComponent(token ?? '')}`);
    const timer = setTimeout(() => reject(new Error('timeout conectando')), 4000);
    socket.once('open', () => {});
    socket.once('message', (raw) => {
      clearTimeout(timer);
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'connected') resolve(socket);
      else reject(new Error(`primer mensaje inesperado: ${raw}`));
    });
    socket.once('close', (code) => {
      clearTimeout(timer);
      reject(Object.assign(new Error('cerrado'), { code }));
    });
    socket.once('error', reject);
  });
}

function nextMessage(socket, ms = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout esperando mensaje')), ms);
    socket.once('message', (raw) => {
      clearTimeout(timer);
      resolve(JSON.parse(raw.toString()));
    });
  });
}

test('sin token válido, /ws cierra la conexión (4001)', async () => {
  await assert.rejects(connect('token-invalido'), (err) => err.code === 4001);
});

test('/ws: una reacción avisa SOLO a quien escribió el post, sin contenido', async () => {
  const ana = await ctx.cuenta('ws-ana@upb.edu.co');
  const beto = await ctx.cuenta('ws-beto@upb.edu.co');
  const tercero = await ctx.cuenta('ws-tercero@upb.edu.co');

  const socketAna = await connect(ana.token);
  const socketTercero = await connect(tercero.token);

  const post = (await ctx.call('POST', '/posts', ana.token, { body: 'hola comunidad' })).body.post;

  const [avisoAna] = await Promise.all([
    nextMessage(socketAna),
    ctx.call('POST', `/posts/${post.id}/react`, beto.token, { kind: 'abrazo' }),
  ]);

  assert.deepEqual(avisoAna, { type: 'notification' });

  // El tercero (conectado, pero ajeno a este post) no recibe nada: se
  // comprueba que no llegue ningún mensaje en una ventana corta.
  await assert.rejects(nextMessage(socketTercero, 800));

  socketAna.close();
  socketTercero.close();
});

test('/ws: un mensaje nuevo avisa al otro participante con la conversación, sin el texto', async () => {
  const ana = await ctx.cuenta('ws-msg-ana@upb.edu.co', { name: 'AnaWS' });
  const beto = await ctx.cuenta('ws-msg-beto@upb.edu.co', { name: 'BetoWS' });

  await ctx.owner.query('update public.profiles set messages_enabled = true where id = any($1::uuid[])', [[ana.id, beto.id]]);
  await ctx.call('POST', `/users/${beto.publicId}/follow`, ana.token);
  await ctx.call('POST', `/users/${ana.publicId}/follow`, beto.token);

  const socketBeto = await connect(beto.token);

  const start = (await ctx.call('POST', '/messages/conversations', ana.token, {
    publicId: beto.publicId, body: 'hola, ¿cómo estás?',
  })).body.conversation;
  await ctx.call('POST', `/messages/conversations/${start.id}/accept`, beto.token);

  const [aviso] = await Promise.all([
    nextMessage(socketBeto),
    ctx.call('POST', `/messages/conversations/${start.id}/messages`, ana.token, { body: 'segundo mensaje, ya aceptaste' }),
  ]);

  assert.equal(aviso.type, 'message');
  assert.equal(aviso.conversationId, start.id);
  assert.equal(Object.keys(aviso).sort().join(','), 'conversationId,type');

  socketBeto.close();
});
