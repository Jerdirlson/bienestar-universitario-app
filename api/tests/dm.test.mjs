// Mensajes privados (api/API.md § Mensajes): activar/desactivar, solo entre
// perfiles con alias que se siguen mutuamente y sin bloqueo, solicitud con
// límite de un mensaje hasta aceptar, filtro ANTES de entregar (crisis se
// entrega con SOS; acoso/datos personales no), límites de frecuencia,
// reportar, y retención de 90 días salvo un caso de reporte abierto.
//
//   bash api/run-tests.sh
//
// Límites de mensajería bajados aquí (cada archivo de pruebas es su propio
// proceso — config.js los lee al importarse, igual que limits.test.mjs).

process.env.RATE_LIMIT_DM_REQUESTS_PER_DAY = '3';
process.env.RATE_LIMIT_MESSAGES_PER_HOUR = '4';

const test = (await import('node:test')).default;
const assert = (await import('node:assert/strict')).default;
const { startApi, EN_REVISION } = await import('./helpers.mjs');

const { owner, cuenta, call, stop } = await startApi();

const ana = await cuenta('dm-ana@upb.edu.co', { name: 'Ana DM' });
const beto = await cuenta('dm-beto@upb.edu.co', { name: 'Beto DM' });
const caro = await cuenta('dm-caro@upb.edu.co', { name: 'Caro DM' });
const dana = await cuenta('dm-dana@upb.edu.co'); // sin alias: nunca puede mandar ni recibir DM
const mod = await cuenta('dm-mod@upb.edu.co', { role: 'moderator', name: 'Mod DM' });

test.after(stop);

async function enable(who, enabled = true) {
  const r = await call('PUT', '/messages/settings', who.token, { enabled });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}
async function followEachOther(a, b) {
  assert.equal((await call('POST', `/users/${a.publicId}/follow`, b.token)).status, 200);
  assert.equal((await call('POST', `/users/${b.publicId}/follow`, a.token)).status, 200);
}

test('desactivado por defecto', async () => {
  const r = await call('GET', '/messages/settings', caro.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.enabled, false);
});

test('sin seguimiento mutuo no se puede escribir', async () => {
  await enable(caro);
  const r = await call('POST', '/messages/conversations', ana.token, { publicId: caro.publicId, body: 'hola' });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'no_se_siguen_mutuamente');
});

test('con los mensajes desactivados nadie puede escribir', async () => {
  await enable(caro, false);
  await followEachOther(ana, caro);
  const r = await call('POST', '/messages/conversations', ana.token, { publicId: caro.publicId, body: 'hola' });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'mensajes_desactivados');
});

test('una cuenta sin alias no puede iniciar (nunca desde contenido anónimo)', async () => {
  // dana no tiene alias: ni siquiera puede seguir a Ana de vuelta (follow_user
  // exige que el DESTINO tenga alias — ahí no hay mutuo posible), así que
  // start_conversation debe rechazarla por falta de nombre antes de llegar a
  // comprobar nada más.
  await enable(dana);
  await call('POST', `/users/${dana.publicId}/follow`, ana.token);
  const r1 = await call('POST', '/messages/conversations', dana.token, { publicId: ana.publicId, body: 'hola' });
  assert.equal(r1.status, 400);
  assert.equal(r1.body.error, 'falta_nombre');
});

test('flujo completo: solicitud, límite de un mensaje, aceptar, conversar, marcar leído', async () => {
  await enable(ana);
  await enable(beto);
  await followEachOther(ana, beto);

  const first = await call('POST', '/messages/conversations', ana.token, { publicId: beto.publicId, body: 'hola Beto' });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.conversation.status, 'pending');
  assert.equal(first.body.conversation.requested_by_me, true);
  assert.equal(first.body.moderation.outcome, 'delivered');
  assert.equal(first.body.moderation.reason, null);
  const convId = first.body.conversation.id;

  // Ana no puede mandar un segundo mensaje antes de que Beto acepte.
  const second = await call('POST', `/messages/conversations/${convId}/messages`, ana.token, { body: 'otro más' });
  assert.equal(second.status, 409);
  assert.equal(second.body.error, 'solicitud_pendiente');

  // Beto ve la solicitud con el único mensaje de previsualización.
  const requests = await call('GET', '/messages/requests', beto.token);
  assert.equal(requests.status, 200);
  const req = requests.body.requests.find((r) => r.id === convId);
  assert.ok(req, 'Beto debería ver la solicitud');
  assert.equal(req.body, 'hola Beto');
  assert.equal(req.other.public_id, ana.publicId);

  // Beto tampoco puede responder sin aceptar.
  const replyBeforeAccept = await call('POST', `/messages/conversations/${convId}/messages`, beto.token, { body: 'no debería poder' });
  assert.equal(replyBeforeAccept.status, 409);
  assert.equal(replyBeforeAccept.body.error, 'solicitud_pendiente');

  // Ana no puede aceptar su propia solicitud.
  const selfAccept = await call('POST', `/messages/conversations/${convId}/accept`, ana.token);
  assert.equal(selfAccept.status, 409);

  const accept = await call('POST', `/messages/conversations/${convId}/accept`, beto.token);
  assert.equal(accept.status, 200);
  assert.equal(accept.body.conversation.status, 'accepted');

  const reply = await call('POST', `/messages/conversations/${convId}/messages`, beto.token, { body: 'listo, ya acepté' });
  assert.equal(reply.status, 201);
  assert.equal(reply.body.message.is_own, true);

  // Ana ve la conversación en su lista, con no leídos.
  const list = await call('GET', '/messages/conversations', ana.token);
  assert.equal(list.status, 200);
  const conv = list.body.conversations.find((c) => c.id === convId);
  assert.ok(conv);
  assert.equal(conv.unread_count, 1);
  assert.equal(conv.last_message.body, 'listo, ya acepté');

  const unread = await call('GET', '/messages/unread-count', ana.token);
  assert.equal(unread.body.unread, 1);

  const msgs = await call('GET', `/messages/conversations/${convId}/messages`, ana.token);
  assert.equal(msgs.status, 200);
  assert.equal(msgs.body.messages.length, 2);
  assert.equal(msgs.body.messages[0].body, 'hola Beto');
  assert.equal(msgs.body.messages[1].body, 'listo, ya acepté');

  await call('POST', `/messages/conversations/${convId}/read`, ana.token);
  const unreadAfter = await call('GET', '/messages/unread-count', ana.token);
  assert.equal(unreadAfter.body.unread, 0);
});

test('rechazar cierra la conversación', async () => {
  const carla = await cuenta('dm-carla@upb.edu.co', { name: 'Carla DM' });
  await enable(caro);
  await enable(carla);
  await followEachOther(caro, carla);

  const r = await call('POST', '/messages/conversations', caro.token, { publicId: carla.publicId, body: 'hola carla' });
  assert.equal(r.status, 201);
  const convId = r.body.conversation.id;

  const selfReject = await call('POST', `/messages/conversations/${convId}/reject`, caro.token);
  assert.equal(selfReject.status, 409);

  const reject = await call('POST', `/messages/conversations/${convId}/reject`, carla.token);
  assert.equal(reject.status, 200);

  const again = await call('POST', `/messages/conversations/${convId}/messages`, caro.token, { body: 'insisto' });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'conversacion_rechazada');
});

test('crisis: se entrega igual, con el motivo para mostrar el SOS', async () => {
  const eva = await cuenta('dm-eva@upb.edu.co', { name: 'Eva DM' });
  const fer = await cuenta('dm-fer@upb.edu.co', { name: 'Fer DM' });
  await enable(eva); await enable(fer);
  await followEachOther(eva, fer);

  const r = await call('POST', '/messages/conversations', eva.token, { publicId: fer.publicId, body: 'me quiero morir' });
  assert.equal(r.status, 201);
  assert.equal(r.body.moderation.outcome, 'delivered');
  assert.equal(r.body.moderation.reason, 'crisis');

  await call('POST', `/messages/conversations/${r.body.conversation.id}/accept`, fer.token);
  const msgs = await call('GET', `/messages/conversations/${r.body.conversation.id}/messages`, fer.token);
  assert.equal(msgs.body.messages[0].risk, 'high');
  assert.equal(msgs.body.messages[0].body, 'me quiero morir', 'crisis SÍ se entrega, con el texto');
});

test('acoso: no se entrega, el remitente ve por qué', async () => {
  const gio = await cuenta('dm-gio@upb.edu.co', { name: 'Gio DM' });
  const hal = await cuenta('dm-hal@upb.edu.co', { name: 'Hal DM' });
  await enable(gio); await enable(hal);
  await followEachOther(gio, hal);

  const r = await call('POST', '/messages/conversations', gio.token, { publicId: hal.publicId, body: 'eres un idiota' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'mensaje_no_entregado');
  assert.equal(r.body.reason, 'acoso_o_amenaza');

  // No debe haber quedado ninguna conversación ni mensaje: ni el destinatario
  // se entera de que alguien lo intentó.
  const requestsHal = await call('GET', '/messages/requests', hal.token);
  assert.equal(requestsHal.body.requests.length, 0);
});

test('datos personales: tampoco se entrega', async () => {
  const ivo = await cuenta('dm-ivo@upb.edu.co', { name: 'Ivo DM' });
  const jan = await cuenta('dm-jan@upb.edu.co', { name: 'Jan DM' });
  await enable(ivo); await enable(jan);
  await followEachOther(ivo, jan);

  const r = await call('POST', '/messages/conversations', ivo.token, { publicId: jan.publicId, body: `escríbeme${EN_REVISION}` });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'mensaje_no_entregado');
  assert.equal(r.body.reason, 'datos_personales');
});

test('solo texto, hasta 1000 caracteres', async () => {
  const kim = await cuenta('dm-kim@upb.edu.co', { name: 'Kim DM' });
  const leo = await cuenta('dm-leo@upb.edu.co', { name: 'Leo DM' });
  await enable(kim); await enable(leo);
  await followEachOther(kim, leo);

  const tooLong = await call('POST', '/messages/conversations', kim.token, { publicId: leo.publicId, body: 'x'.repeat(1001) });
  assert.equal(tooLong.status, 400);
  assert.equal(tooLong.body.error, 'texto_invalido');

  const empty = await call('POST', '/messages/conversations', kim.token, { publicId: leo.publicId, body: '   ' });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error, 'texto_invalido');
});

test('bloquear oculta la conversación y basta en cualquier sentido', async () => {
  const mia = await cuenta('dm-mia@upb.edu.co', { name: 'Mia DM' });
  const nao = await cuenta('dm-nao@upb.edu.co', { name: 'Nao DM' });
  await enable(mia); await enable(nao);
  await followEachOther(mia, nao);

  const r = await call('POST', '/messages/conversations', mia.token, { publicId: nao.publicId, body: 'hola' });
  await call('POST', `/messages/conversations/${r.body.conversation.id}/accept`, nao.token);

  const block = await call('POST', `/users/${nao.publicId}/block`, mia.token);
  assert.equal(block.status, 200);

  const list = await call('GET', '/messages/conversations', mia.token);
  assert.equal(list.body.conversations.find((c) => c.id === r.body.conversation.id), undefined);

  const newAttempt = await call('POST', '/messages/conversations', mia.token, { publicId: nao.publicId, body: 'de nuevo' });
  assert.equal(newAttempt.status, 404);
});

test('límites de frecuencia: solicitudes nuevas por día y mensajes por hora', async () => {
  const req1 = await cuenta('dm-req1@upb.edu.co', { name: 'Req1 DM' });
  await enable(req1);
  const targets = [];
  for (let i = 0; i < 4; i++) {
    const t = await cuenta(`dm-reqt${i}@upb.edu.co`, { name: `ReqT${i} DM` });
    await enable(t);
    await followEachOther(req1, t);
    targets.push(t);
  }
  for (let i = 0; i < 3; i++) {
    const r = await call('POST', '/messages/conversations', req1.token, { publicId: targets[i].publicId, body: `hola ${i}` });
    assert.equal(r.status, 201, `la solicitud ${i + 1} debería pasar`);
  }
  const over = await call('POST', '/messages/conversations', req1.token, { publicId: targets[3].publicId, body: 'una más' });
  assert.equal(over.status, 429);
  assert.equal(over.body.error, 'demasiadas_solicitudes');
});

test('límites de frecuencia: mensajes por hora', async () => {
  // Cuenta propia, sin usar de las conversaciones del test anterior: el
  // límite diario de solicitudes (3) ya consumiría casi todo el cupo horario
  // (4) si se reutilizara la misma cuenta.
  const hora = await cuenta('dm-hora@upb.edu.co', { name: 'Hora DM' });
  const other = await cuenta('dm-hourly@upb.edu.co', { name: 'Hourly DM' });
  await enable(hora); await enable(other);
  await followEachOther(hora, other);

  const start = await call('POST', '/messages/conversations', hora.token, { publicId: other.publicId, body: 'msg 1' });
  assert.equal(start.status, 201);
  await call('POST', `/messages/conversations/${start.body.conversation.id}/accept`, other.token);
  for (let i = 0; i < 3; i++) {
    const r = await call('POST', `/messages/conversations/${start.body.conversation.id}/messages`, hora.token, { body: `msg ${i + 2}` });
    assert.equal(r.status, 201, `el mensaje ${i + 2} debería pasar`);
  }
  const overHour = await call('POST', `/messages/conversations/${start.body.conversation.id}/messages`, hora.token, { body: 'excedido' });
  assert.equal(overHour.status, 429);
  assert.equal(overHour.body.error, 'demasiados_mensajes');
});

test('reportar: solo participantes, y el panel de moderación solo ve el caso', async () => {
  const oli = await cuenta('dm-oli@upb.edu.co', { name: 'Oli DM' });
  const pat = await cuenta('dm-pat@upb.edu.co', { name: 'Pat DM' });
  await enable(oli); await enable(pat);
  await followEachOther(oli, pat);

  const start = await call('POST', '/messages/conversations', oli.token, { publicId: pat.publicId, body: 'mensaje para reportar' });
  const convId = start.body.conversation.id;
  await call('POST', `/messages/conversations/${convId}/accept`, pat.token);
  const msgId = start.body.conversation.id && (await call('GET', `/messages/conversations/${convId}/messages`, oli.token)).body.messages[0].id;

  // Un tercero no puede reportar.
  const third = await cuenta('dm-third@upb.edu.co', { name: 'Third DM' });
  const badReport = await call('POST', `/messages/${msgId}/report`, third.token, { reason: 'harassment' });
  assert.equal(badReport.status, 404);

  const report = await call('POST', `/messages/${msgId}/report`, pat.token, { reason: 'harassment', detail: 'me insultó' });
  assert.equal(report.status, 200);

  // El moderador ve el caso, con contexto acotado, y puede descartarlo o
  // quitar el mensaje puntual.
  const reports = await call('GET', '/admin/messages/reports', mod.token);
  assert.equal(reports.status, 200);
  const case_ = reports.body.reports.find((r) => r.message_id === msgId);
  assert.ok(case_, 'debería aparecer el caso');
  assert.equal(case_.reason, 'harassment');

  const context = await call('GET', `/admin/messages/reports/${case_.id}/context`, mod.token);
  assert.equal(context.status, 200);
  assert.ok(context.body.messages.length >= 1 && context.body.messages.length <= 6);
  assert.ok(context.body.messages.some((m) => m.id === msgId));
  assert.ok(context.body.messages[0].sender, 'el panel identifica quién mandó cada mensaje del contexto');

  const remove = await call('POST', `/admin/messages/${msgId}/remove`, mod.token);
  assert.equal(remove.status, 200);

  const afterRemove = await call('GET', `/messages/conversations/${convId}/messages`, oli.token);
  const removed = afterRemove.body.messages.find((m) => m.id === msgId);
  assert.equal(removed.removed, true);
  assert.equal(removed.body, null);
});

test('retención: se borra a los 90 días salvo un caso de reporte abierto', async () => {
  const { purgeOldMessages } = await import('../src/messages.js');

  const qui = await cuenta('dm-qui@upb.edu.co', { name: 'Qui DM' });
  const ram = await cuenta('dm-ram@upb.edu.co', { name: 'Ram DM' });
  await enable(qui); await enable(ram);
  await followEachOther(qui, ram);

  const start = await call('POST', '/messages/conversations', qui.token, { publicId: ram.publicId, body: 'mensaje viejo sin reporte' });
  const convId = start.body.conversation.id;
  await call('POST', `/messages/conversations/${convId}/accept`, ram.token);
  const second = await call('POST', `/messages/conversations/${convId}/messages`, qui.token, { body: 'mensaje viejo CON reporte abierto' });

  const oldMsgId = start.body.conversation.id && (await call('GET', `/messages/conversations/${convId}/messages`, qui.token)).body.messages[0].id;
  const reportedMsgId = second.body.message.id;

  await call('POST', `/messages/${reportedMsgId}/report`, ram.token, { reason: 'spam' });

  await owner.query(`update public.messages set created_at = now() - interval '91 days' where id = any($1)`, [[oldMsgId, reportedMsgId]]);

  await purgeOldMessages();

  const after = await owner.query('select id from public.messages where id = any($1)', [[oldMsgId, reportedMsgId]]);
  const ids = after.rows.map((r) => r.id);
  assert.ok(!ids.includes(oldMsgId), 'el mensaje viejo sin reporte debería haberse borrado');
  assert.ok(ids.includes(reportedMsgId), 'el mensaje con un caso de reporte abierto debería conservarse');
});
