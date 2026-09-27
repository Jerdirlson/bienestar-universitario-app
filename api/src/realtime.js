import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { withUser } from './db.js';

/**
 * Canal en vivo para el panel de administración: "algo cambió en la cola de
 * moderación, volvé a pedirla". Deliberadamente tonto — no manda el estado
 * completo por el socket, solo avisa (y, si lo que cambió fue una crisis
 * nueva, un aviso de qué tipo de caso es, para que el panel abierto suene y
 * parpadee — nunca contenido). El panel sigue pidiendo los datos reales por
 * HTTP (con la sesión ya validada ahí), así que un mensaje de WebSocket
 * armado a mano no puede filtrar ni cambiar nada por sí solo.
 *
 * La sesión del WebSocket se valida igual que cualquier otra: el JWT viaja
 * por query string porque el navegador no deja poner headers en el handshake
 * de WebSocket, y se exige is_moderator() antes de aceptar la conexión — no
 * alcanza con estar logueado. is_moderator() y no is_admin(): un moderador
 * también necesita el canal en vivo para la cola y los reportes.
 */

let wss = null;

export function attachRealtime(server) {
  wss = new WebSocketServer({ server, path: '/admin/ws' });

  wss.on('connection', async (socket, request) => {
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

  return wss;
}

/**
 * Avisa a todos los paneles conectados que la cola cambió.
 * `crisis: true` cuando lo que cambió es un caso NUEVO de crisis (recién
 * retenido) — el panel lo usa para el aviso visual y sonoro. Nunca lleva
 * nada más: ni el id, ni si es post o comentario, ni una migaja de contenido.
 */
export function broadcastQueueChanged({ crisis = false } = {}) {
  if (!wss) return;
  const payload = JSON.stringify({ type: 'queue_changed', crisis });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}
