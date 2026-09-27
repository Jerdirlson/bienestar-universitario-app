import { withServiceRole } from './db.js';
import { config } from './config.js';

/**
 * Notificaciones push (Expo), para cuando la app está cerrada y no hay
 * ningún socket de /ws escuchando (api/src/realtime.js).
 *
 * Nunca lleva contenido de lo que pasó ni identifica a quien lo escribió —
 * solo un texto genérico por tipo de notificación, igual que el correo de
 * alertas de crisis (api/src/alerts.js). `data` lleva lo mínimo para que la
 * app abra la pantalla correcta al tocarla (el tipo y, si aplica, la
 * conversación) — nunca el excerpt.
 *
 * Regla de oro, igual que alerts.js: esto NUNCA puede romper ni demorar la
 * petición que lo dispara. Se llama siempre fire-and-forget, después de que
 * el trigger de Postgres ya avisó por /ws (api/src/realtime.js), y todo
 * error se traga y se registra.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Un texto por tipo de notificación (public.notifications.kind). Sin entrada
// para un tipo, sencillamente no se manda push — eso es "moderation_alert" y
// el resto, todos con texto; no hay ninguno pensado para quedar en silencio,
// pero un tipo nuevo que se agregue algún día sin actualizar esto no debe
// mandar un push vacío ni romper nada.
const TEXT_BY_KIND = {
  post_reaction: 'Alguien reaccionó a tu publicación.',
  post_comment: 'Tienes un comentario nuevo.',
  comment_reply: 'Tienes una respuesta nueva.',
  comment_like: 'A alguien le gustó tu comentario.',
  new_follower: 'Tienes un nuevo seguidor.',
  post_approved: 'Tu publicación fue aprobada.',
  post_rejected: 'Tu publicación no fue aprobada.',
  post_hidden: 'Una publicación tuya fue retirada.',
  comment_approved: 'Tu comentario fue aprobado.',
  comment_rejected: 'Tu comentario no fue aprobado.',
  support_sent: 'Recibiste un mensaje de apoyo del equipo de moderación.',
  message_request: 'Tienes una solicitud de mensaje nueva.',
  new_message: 'Tienes un mensaje nuevo.',
  moderation_alert: 'Hay casos de crisis esperando atención.',
};

// Inyectable para las pruebas (api/tests/push.test.mjs mockea esto en vez de
// pegarle a la Expo real). Sin inyectar, usa el fetch global de Node.
let fetchImpl = (...args) => globalThis.fetch(...args);
export function __setFetchForTests(fn) {
  fetchImpl = fn ?? ((...args) => globalThis.fetch(...args));
}

async function tokensFor(recipientId) {
  return withServiceRole(async (client) => {
    const { rows } = await client.query(
      `select pt.token from public.push_tokens pt
         join public.profiles p on p.id = pt.user_id
        where pt.user_id = $1 and p.push_enabled = true`,
      [recipientId]
    );
    return rows.map((r) => r.token);
  });
}

async function deleteTokens(recipientId, tokens) {
  if (tokens.length === 0) return;
  await withServiceRole((client) =>
    client.query(
      'delete from public.push_tokens where user_id = $1 and token = any($2::text[])',
      [recipientId, tokens]
    ));
}

/**
 * Manda un push genérico a todos los dispositivos de `recipientId`, según el
 * `kind` de la notificación que se acaba de crear (ver el trigger en
 * supabase/migrations/20260928000002_push_and_realtime.sql). No hace nada —
 * en silencio — si PUSH_ENABLED=false, si la persona apagó su interruptor, si
 * no tiene ningún token, o si el tipo no tiene texto genérico.
 */
export async function sendPushForNotification(recipientId, kind, { conversationId = null } = {}) {
  if (!config.pushEnabled || !recipientId) return;
  const body = TEXT_BY_KIND[kind];
  if (!body) return;

  try {
    const tokens = await tokensFor(recipientId);
    if (tokens.length === 0) return;

    const messages = tokens.map((to) => ({
      to,
      title: 'Raíz',
      body,
      sound: 'default',
      data: { kind, conversationId },
    }));

    const res = await fetchImpl(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const data = await res.json().catch(() => null);
    const tickets = Array.isArray(data?.data) ? data.data : [];

    const invalid = [];
    tickets.forEach((ticket, i) => {
      if (ticket?.details?.error === 'DeviceNotRegistered') invalid.push(tokens[i]);
    });
    if (invalid.length) await deleteTokens(recipientId, invalid);
  } catch (error) {
    console.error('[push] fallo enviando la notificación push:', error.message);
  }
}
