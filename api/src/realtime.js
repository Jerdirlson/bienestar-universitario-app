import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { config } from './config.js';
import { withUser } from './db.js';
import { sendPushForNotification } from './push.js';

/**
 * Dos canales de WebSocket sobre el mismo servidor HTTP:
 *
 * · /admin/ws — panel de administración (sin cambios: solo moderadores y
 *   administradores, avisa "la cola cambió", nunca contenido).
 * · /ws — CUALQUIER sesión abierta de la app. Avisa "tenés una notificación
 *   nueva" o "llegó un mensaje en esta conversación" para que el cliente
 *   refresque al instante en vez de esperar el sondeo de 60 s. Tampoco lleva
 *   contenido: el cliente vuelve a pedir los datos por HTTP, con su sesión ya
 *   validada ahí (mismo principio que /admin/ws — ver el comentario de más
 *   abajo).
 *
 * El dato que dispara ambos avisos de /ws nace en Postgres (un trigger AFTER
 * INSERT en notifications y otro en messages — ver
 * supabase/migrations/20260928000002_push_and_realtime.sql) y llega acá por
 * LISTEN/NOTIFY: un solo punto de enganche que cubre todo lo que inserta una
 * notificación, sin importar si lo hizo un trigger de la base o el API como
 * service_role (admin.js, alerts.js). Esa misma llegada dispara el push
 * (api/src/push.js) cuando no hay socket abierto para avisar al instante.
 */

let wssAdmin = null;
let wssUsers = null;

/** userId (string) → Set<WebSocket>. Varias pestañas o dispositivos a la vez. */
const userSockets = new Map();
const MAX_SOCKETS_PER_USER = 5;
const PING_INTERVAL_MS = 30_000;

function addUserSocket(userId, socket) {
  let set = userSockets.get(userId);
  if (!set) {
    set = new Set();
    userSockets.set(userId, set);
  }
  // Límite de conexiones por persona: en vez de rechazar la nueva (que suele
  // ser la que la persona más necesita — acaba de abrir la app), se cierra la
  // más vieja. Cubre el caso normal (reconexiones tras perder cobertura sin
  // que el socket viejo llegara a cerrarse todavía).
  if (set.size >= MAX_SOCKETS_PER_USER) {
    const oldest = set.values().next().value;
    try { oldest.close(4008, 'demasiadas_conexiones'); } catch { /* ya podría estar cerrado */ }
    set.delete(oldest);
  }
  set.add(socket);
}

function removeUserSocket(userId, socket) {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) userSockets.delete(userId);
}

function sendToUser(userId, payload) {
  const set = userSockets.get(String(userId));
  if (!set || set.size === 0) return;
  const data = JSON.stringify(payload);
  for (const socket of set) {
    if (socket.readyState === socket.OPEN) socket.send(data);
  }
}

/**
 * ping/pong cada 30 s: RN y los navegadores no siempre avisan que una
 * conexión murió (wifi que se va sin cerrar nada limpio) — sin esto, un
 * socket "zombi" se queda en el mapa recibiendo avisos que nunca llegan a
 * ningún lado. Quien no responda un ping antes del siguiente se cierra.
 */
function heartbeat(wss) {
  return setInterval(() => {
    for (const socket of wss.clients) {
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      try { socket.ping(); } catch { /* socket ya cerrándose */ }
    }
  }, PING_INTERVAL_MS).unref();
}

export function attachRealtime(server) {
  // noServer + un solo 'upgrade' manual: si cada WebSocketServer se cuelga
  // del server con su propio `path`, los dos reciben CADA upgrade (es un
  // evento normal, con dos listeners) y el que no matchea aborta el handshake
  // con 400 así sin más (ws/lib/websocket-server.js: handleUpgrade destruye
  // el socket si shouldHandle() da false) — puede llegar antes que el que sí
  // matchea y tumbar la conexión igual. Enrutar a mano por el pathname evita
  // esa carrera.
  wssAdmin = new WebSocketServer({ noServer: true });
  wssUsers = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    if (pathname === '/admin/ws') {
      wssAdmin.handleUpgrade(request, socket, head, (ws) => wssAdmin.emit('connection', ws, request));
    } else if (pathname === '/ws') {
      wssUsers.handleUpgrade(request, socket, head, (ws) => wssUsers.emit('connection', ws, request));
    } else {
      socket.destroy();
    }
  });

  wssAdmin.on('connection', async (socket, request) => {
    const url = new URL(request.url, 'http://localhost');
    const token = url.searchParams.get('token');

    let userId;
    try {
      userId = jwt.verify(token, config.jwtSecret).sub;
    } catch {
      socket.close(4001, 'sesion_invalida');
      return;
    }

    const isModerator = await withUser(userId, async (client) => {
      const { rows } = await client.query('select public.is_moderator() as ok');
      return rows[0].ok;
    }).catch(() => false);

    if (!isModerator) {
      socket.close(4003, 'no_autorizado');
      return;
    }

    socket.send(JSON.stringify({ type: 'connected' }));
  });
  heartbeat(wssAdmin);

  // ── /ws: cualquier sesión con JWT válido ──────────────────────────────────
  wssUsers.on('connection', (socket, request) => {
    const url = new URL(request.url, 'http://localhost');
    const token = url.searchParams.get('token');

    let userId;
    try {
      userId = jwt.verify(token, config.jwtSecret).sub;
    } catch {
      socket.close(4001, 'sesion_invalida');
      return;
    }

    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });

    const uid = String(userId);
    addUserSocket(uid, socket);
    socket.on('close', () => removeUserSocket(uid, socket));

    socket.send(JSON.stringify({ type: 'connected' }));
  });
  heartbeat(wssUsers);

  startEventListener();

  return { wssAdmin, wssUsers };
}

/**
 * Avisa a todos los paneles conectados que la cola cambió.
 * `crisis: true` cuando lo que cambió es un caso NUEVO de crisis (recién
 * retenido) — el panel lo usa para el aviso visual y sonoro. Nunca lleva
 * nada más: ni el id, ni si es post o comentario, ni una migaja de contenido.
 */
export function broadcastQueueChanged({ crisis = false } = {}) {
  if (!wssAdmin) return;
  const payload = JSON.stringify({ type: 'queue_changed', crisis });
  for (const client of wssAdmin.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conexión LISTEN dedicada: un solo lugar que se entera de toda notificación
// o mensaje nuevo (ver el trigger en la migración citada arriba).
// ─────────────────────────────────────────────────────────────────────────────

let listenClient = null;
let reconnectTimer = null;
let stopped = false;

function handleEvent(raw) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  if (!payload?.recipient_id) return;

  if (payload.kind === 'notification') {
    sendToUser(payload.recipient_id, { type: 'notification' });
    // Fire-and-forget: el push nunca debe demorar ni romper el reparto en
    // tiempo real, y ya se traga sus propios errores (api/src/push.js).
    sendPushForNotification(payload.recipient_id, payload.notification_kind, {
      conversationId: payload.conversation_id ?? null,
    });
  } else if (payload.kind === 'message') {
    sendToUser(payload.recipient_id, { type: 'message', conversationId: payload.conversation_id });
  }
}

async function connectListener() {
  if (stopped) return;
  const client = new pg.Client({ connectionString: config.databaseUrl });
  try {
    await client.connect();
    await client.query('listen raiz_events');
    listenClient = client;
    client.on('notification', (msg) => handleEvent(msg.payload));
    client.on('error', (error) => {
      console.error('[realtime] error en la conexión LISTEN:', error.message);
      scheduleReconnect();
    });
    client.on('end', () => {
      if (!stopped) scheduleReconnect();
    });
  } catch (error) {
    console.error('[realtime] no se pudo conectar LISTEN:', error.message);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (stopped || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectListener();
  }, 5000);
  reconnectTimer.unref?.();
}

let started = false;
function startEventListener() {
  if (started) return;
  started = true;
  stopped = false;
  connectListener();
}

export async function stopEventListener() {
  stopped = true;
  started = false;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (listenClient) {
    const c = listenClient;
    listenClient = null;
    await c.end().catch(() => {});
  }
}
