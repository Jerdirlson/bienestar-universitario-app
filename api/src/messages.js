import { Router } from 'express';
import { withUser, withServiceRole } from './db.js';
import { requireSession } from './auth.js';
import { config } from './config.js';
import { screen } from './moderation.js';
import {
  REPORT_REASONS, httpError, sendError, isUuid, uuidParam, parseBefore, parseLimit, cursorSql,
} from './community.js';

/**
 * Mensajes privados (contrato v2, ver api/API.md § Mensajes).
 *
 * Resumen de las reglas de producto (docs/auditoria/competencia.md §4 y
 * CLAUDE.md): desactivado por defecto, solo entre perfiles CON ALIAS que se
 * siguen mutuamente y sin bloqueo, el primer mensaje es una solicitud que
 * limita al remitente a uno solo hasta que se acepte, filtro automático
 * ANTES de entregar (crisis se entrega con SOS al remitente y aviso cálido
 * al destinatario; acoso/amenaza o datos personales NO se entregan, el
 * remitente ve por qué), límites de frecuencia, reportar y bloquear en un
 * toque, retención de 90 días salvo lo que esté en un caso de reporte
 * abierto.
 *
 * Casi toda la lógica de estado (quién puede escribir a quién, el límite de
 * un mensaje antes de aceptar, aceptar/rechazar, marcar leído) vive en
 * funciones security definer de la migración …_direct_messages.sql — este
 * router decide lo que SOLO puede decidir código (el filtro de moderación,
 * que es JS puro) y traduce errores. Igual que community.js: withUser dentro,
 * la base decide qué se puede.
 *
 * Bloquear NO tiene ruta propia aquí: reutiliza POST /users/:publicId/block
 * (el otro participante siempre es un perfil con nombre) con el public_id que
 * ya trae el objeto Conversation.
 */

const MESSAGE_MAX = 1000;
const REPORT_DETAIL_MAX = 1000;

export const messagesRouter = Router();
messagesRouter.use(requireSession);
messagesRouter.param('id', uuidParam);
messagesRouter.param('messageId', uuidParam);

function sendMessagesError(res, next, error) {
  if (error.httpStatus) return res.status(error.httpStatus).json({ error: error.code });
  const STATUS_BY_CODE = {
    sin_sesion: 401,
    falta_nombre: 400,
    accion_invalida: 400,
    mensajes_desactivados: 403,
    no_se_siguen_mutuamente: 403,
    solicitud_pendiente: 409,
    conversacion_rechazada: 409,
    estado_invalido: 409,
    riesgo_invalido: 400,
    no_autorizado: 403,
  };
  const status = STATUS_BY_CODE[error.message];
  if (status) return res.status(status).json({ error: error.message });
  return sendError(res, next, error);
}

function validateBody(raw) {
  if (typeof raw !== 'string') throw httpError(400, 'texto_invalido');
  const text = raw.trim();
  if (text.length < 1 || text.length > MESSAGE_MAX) throw httpError(400, 'texto_invalido');
  return text;
}

const PUBLIC_ID_RE = /^[a-z0-9]{4,32}$/;

/**
 * El filtro corre ANTES de tocar la base (moderation.js es puro y síncrono):
 * crisis SÍ se entrega (con `risk: 'high'`, el sender ve el SOS); acoso o
 * datos personales NUNCA se inserta — el remitente ve por qué en el acto.
 */
function screenMessage(text) {
  const result = screen(text);
  if (result.outcome === 'published') return { delivered: true, risk: 'none' };
  if (result.reason === 'crisis') return { delivered: true, risk: 'high' };
  const reason = result.note?.startsWith('acoso') ? 'acoso_o_amenaza' : 'datos_personales';
  return { delivered: false, reason };
}

/**
 * Límite de mensajes por hora, contado igual que enforceRate en posts.js
 * (public.publication_events, candado consultivo). Semilla de candado
 * distinta (2) de la de posts (0) para no compartir el mismo bloqueo por
 * nada: son límites independientes.
 */
async function enforceMessageRate(client) {
  await client.query('select pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 2))');
  const { rows } = await client.query(
    `select count(*)::int as n from public.publication_events
      where user_id = auth.uid() and kind = 'message' and created_at > now() - interval '1 hour'`
  );
  if (rows[0].n >= config.limits.messagesPerHour) throw httpError(429, 'demasiados_mensajes');
}

function mapConversationRow(row) {
  return {
    id: row.id,
    status: row.status,
    created_at: row.created_at,
    accepted_at: row.accepted_at,
    last_message_at: row.last_message_at,
    requested_by_me: !!row.requested_by_me,
    other: row.other ?? null,
  };
}

function mapMessageRow(row) {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    body: row.removed ? null : row.body,
    removed: !!row.removed,
    risk: row.risk,
    created_at: row.created_at,
    read: row.read_at != null,
    is_own: !!row.is_own,
  };
}

async function loadConversation(userId, id) {
  return withUser(userId, async (client) => {
    const { rows } = await client.query(
      `select c.id, c.status, c.created_at, c.accepted_at, c.last_message_at,
              (c.requested_by = auth.uid()) as requested_by_me,
              public.conversation_other(c.id) as other
         from public.conversations c
        where c.id = $1 and (c.user_a = auth.uid() or c.user_b = auth.uid())`,
      [id]
    );
    if (!rows[0]) throw httpError(404, 'not_found');
    return mapConversationRow(rows[0]);
  });
}

async function loadMessage(userId, id) {
  return withUser(userId, async (client) => {
    const { rows } = await client.query(
      `select m.id, m.conversation_id, m.body, m.created_at, m.read_at, m.risk,
              (m.removed_at is not null) as removed, (m.sender_id = auth.uid()) as is_own
         from public.messages m where m.id = $1`,
      [id]
    );
    if (!rows[0]) throw httpError(404, 'not_found');
    return mapMessageRow(rows[0]);
  });
}

function moderationResult(screening) {
  return { outcome: 'delivered', reason: screening.risk === 'high' ? 'crisis' : null };
}

// ── preferencia ──────────────────────────────────────────────────────────

messagesRouter.get('/settings', async (req, res, next) => {
  try {
    const enabled = await withUser(req.userId, async (client) => {
      const { rows } = await client.query('select messages_enabled from public.profiles where id = auth.uid()');
      return !!rows[0]?.messages_enabled;
    });
    res.json({ enabled });
  } catch (error) {
    sendMessagesError(res, next, error);
  }
});

messagesRouter.put('/settings', async (req, res, next) => {
  try {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'valor_invalido' });
    await withUser(req.userId, (client) =>
      client.query('update public.profiles set messages_enabled = $1 where id = auth.uid()', [enabled]));
    res.json({ ok: true, enabled });
  } catch (error) {
    sendMessagesError(res, next, error);
  }
});

// ── no leídos (sondeo, junto al de notificaciones) ─────────────────────────

messagesRouter.get('/unread-count', async (req, res, next) => {
  try {
    const data = await withUser(req.userId, async (client) => {
      const unread = await client.query(
        `select count(*)::int as n from public.messages m
           join public.conversations c on c.id = m.conversation_id
          where (c.user_a = auth.uid() or c.user_b = auth.uid()) and c.status = 'accepted'
            and m.sender_id <> auth.uid() and m.read_at is null`
      );
      const requests = await client.query(
        `select count(*)::int as n from public.conversations c
          where c.status = 'pending' and c.requested_by <> auth.uid()
            and (c.user_a = auth.uid() or c.user_b = auth.uid())`
      );
      return { unread: unread.rows[0].n, requests: requests.rows[0].n };
    });
    res.json(data);
  } catch (error) {
    sendMessagesError(res, next, error);
  }
});

// ── listas ───────────────────────────────────────────────────────────────

messagesRouter.get('/conversations', async (req, res, next) => {
  try {
    const before = parseBefore(req.query.before);
    const limit = parseLimit(req.query.limit);
    const rows = await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `select c.id, c.status, c.created_at, c.accepted_at, c.last_message_at,
                public.conversation_other(c.id) as other,
                (select count(*)::int from public.messages m
                  where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null) as unread_count,
                (select jsonb_build_object(
                          'body', case when m2.removed_at is null then m2.body else null end,
                          'removed', m2.removed_at is not null,
                          'is_own', m2.sender_id = auth.uid(),
                          'created_at', m2.created_at)
                   from public.messages m2 where m2.conversation_id = c.id
                  order by m2.created_at desc limit 1) as last_message,
                ${cursorSql('c.last_message_at')} as _cursor
           from public.conversations c
          where (c.user_a = auth.uid() or c.user_b = auth.uid()) and c.status = 'accepted'
            and not public.conversation_blocked(c.id)
            and ($1::timestamptz is null or c.last_message_at < $1::timestamptz)
          order by c.last_message_at desc
          limit $2`,
        [before, limit]
      );
      return rows;
    });
    res.json({
      conversations: rows.map((row) => ({ ...mapConversationRow(row), unread_count: row.unread_count, last_message: row.last_message ?? null })),
      next_before: rows.length === limit ? rows[rows.length - 1]._cursor : null,
    });
  } catch (error) {
    sendMessagesError(res, next, error);
  }
});

messagesRouter.get('/requests', async (req, res, next) => {
  try {
    const rows = await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `select c.id, c.created_at,
                public.conversation_other(c.id) as other,
                (select m.body from public.messages m where m.conversation_id = c.id
                  order by m.created_at asc limit 1) as body
           from public.conversations c
          where c.status = 'pending' and c.requested_by <> auth.uid()
            and (c.user_a = auth.uid() or c.user_b = auth.uid())
            and not public.conversation_blocked(c.id)
          order by c.created_at desc`
      );
      return rows;
    });
    res.json({ requests: rows.map((r) => ({ id: r.id, created_at: r.created_at, other: r.other, body: r.body })) });
  } catch (error) {
    sendMessagesError(res, next, error);
  }
});

// ── abrir y enviar ───────────────────────────────────────────────────────

messagesRouter.get('/conversations/:id', async (req, res, next) => {
  try {
    res.json({ conversation: await loadConversation(req.userId, req.params.id) });
  } catch (error) {
    sendMessagesError(res, next, error);
  }
});

messagesRouter.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const before = parseBefore(req.query.before);
    const limit = parseLimit(req.query.limit);
    const rows = await withUser(req.userId, async (client) => {
      const own = await client.query(
        `select 1 from public.conversations c where c.id = $1 and (c.user_a = auth.uid() or c.user_b = auth.uid())`,
        [req.params.id]
      );
      if (!own.rows[0]) throw httpError(404, 'not_found');
      const { rows } = await client.query(
        `select m.id, m.conversation_id, m.body, m.created_at, m.read_at, m.risk,
                (m.removed_at is not null) as removed, (m.sender_id = auth.uid()) as is_own,
                ${cursorSql('m.created_at')} as _cursor
           from public.messages m
          where m.conversation_id = $1 and ($2::timestamptz is null or m.created_at < $2::timestamptz)
          order by m.created_at desc
          limit $3`,
        [req.params.id, before, limit]
      );
      return rows;
    });
    res.json({
      messages: [...rows].reverse().map(mapMessageRow),
      next_before: rows.length === limit ? rows[rows.length - 1]._cursor : null,
    });
  } catch (error) {
    sendMessagesError(res, next, error);
  }
});

/** Inicia (o reabre) una conversación Y manda el primer mensaje — es la solicitud. */
messagesRouter.post('/conversations', async (req, res, next) => {
  try {
    const publicId = req.body?.publicId;
    if (typeof publicId !== 'string' || !PUBLIC_ID_RE.test(publicId)) return res.status(404).json({ error: 'not_found' });
    const text = validateBody(req.body?.body);
    const screening = screenMessage(text);
    if (!screening.delivered) return res.status(400).json({ error: 'mensaje_no_entregado', reason: screening.reason });

    const conversationId = await withUser(req.userId, async (client) => {
      const { rows } = await client.query('select * from public.start_conversation($1)', [publicId]);
      const conv = rows[0];
      if (conv.created) {
        // Recién nacida: solo entonces cuenta contra el tope diario de
        // solicitudes nuevas. Si lo excede, esta misma transacción se
        // revierte entera (db.js hace rollback al lanzar) — no queda huérfana.
        const { rows: cnt } = await client.query(
          `select count(*)::int as n from public.publication_events
            where user_id = auth.uid() and kind = 'dm_request' and created_at > now() - interval '1 day'`
        );
        if (cnt[0].n > config.limits.dmRequestsPerDay) throw httpError(429, 'demasiadas_solicitudes');
      }
      await enforceMessageRate(client);
      await client.query('select public.send_message($1, $2, $3)', [conv.id, text, screening.risk]);
      return conv.id;
    });

    const conversation = await loadConversation(req.userId, conversationId);
    res.status(201).json({ conversation, moderation: moderationResult(screening) });
  } catch (error) {
    sendMessagesError(res, next, error);
  }
});

/** Manda un mensaje en una conversación ya abierta (aceptada, o pendiente propia). */
messagesRouter.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const text = validateBody(req.body?.body);
    const screening = screenMessage(text);
    if (!screening.delivered) return res.status(400).json({ error: 'mensaje_no_entregado', reason: screening.reason });

    const messageId = await withUser(req.userId, async (client) => {
      await enforceMessageRate(client);
      const { rows } = await client.query('select public.send_message($1, $2, $3) as id', [req.params.id, text, screening.risk]);
      return rows[0].id;
    });

    const message = await loadMessage(req.userId, messageId);
    res.status(201).json({ message, moderation: moderationResult(screening) });
  } catch (error) {
    sendMessagesError(res, next, error);
  }
});

// ── aceptar / rechazar / leer ───────────────────────────────────────────

messagesRouter.post('/conversations/:id/accept', async (req, res, next) => {
  try {
    await withUser(req.userId, (client) => client.query('select public.accept_conversation($1)', [req.params.id]));
    res.json({ ok: true, conversation: await loadConversation(req.userId, req.params.id) });
  } catch (error) {
    sendMessagesError(res, next, error);
  }
});

messagesRouter.post('/conversations/:id/reject', async (req, res, next) => {
  try {
    await withUser(req.userId, (client) => client.query('select public.reject_conversation($1)', [req.params.id]));
    res.json({ ok: true });
  } catch (error) {
    sendMessagesError(res, next, error);
  }
});

messagesRouter.post('/conversations/:id/read', async (req, res, next) => {
  try {
    await withUser(req.userId, (client) => client.query('select public.mark_conversation_read($1)', [req.params.id]));
    res.json({ ok: true });
  } catch (error) {
    sendMessagesError(res, next, error);
  }
});

// ── reportar ─────────────────────────────────────────────────────────────
// Bloquear no tiene ruta propia: POST /users/:publicId/block con
// conversation.other.public_id (ver comentario de cabecera).

messagesRouter.post('/:messageId/report', async (req, res, next) => {
  try {
    const reason = req.body?.reason;
    if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ error: 'motivo_invalido' });
    const detail = typeof req.body?.detail === 'string' ? req.body.detail.trim().slice(0, REPORT_DETAIL_MAX) || null : null;

    await withUser(req.userId, async (client) => {
      const { rows } = await client.query('select conversation_id from public.messages where id = $1', [req.params.messageId]);
      if (!rows[0]) throw httpError(404, 'not_found');
      await client.query(
        `insert into public.message_reports (message_id, conversation_id, reporter_id, reason, detail)
           values ($1, $2, auth.uid(), $3, $4)
         on conflict (message_id, reporter_id) do nothing`,
        [req.params.messageId, rows[0].conversation_id, reason, detail]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    sendMessagesError(res, next, error);
  }
});

// ── retención (90 días, salvo casos de reporte abiertos) ──────────────────
// Tarea periódica, igual que el resumen de crisis (api/src/alerts.js). Se
// exporta purgeOldMessages() aparte para poder probarla directo, sin
// esperar 90 días ni un intervalo real.

export async function purgeOldMessages() {
  return withServiceRole(async (client) => {
    const { rowCount } = await client.query(
      `delete from public.messages
        where created_at < now() - interval '90 days'
          and not exists (
            select 1 from public.message_reports r where r.message_id = messages.id and r.resolved_at is null
          )`
    );
    return rowCount;
  });
}

let retentionInterval = null;

export function startMessageRetention() {
  if (retentionInterval) return;
  purgeOldMessages().catch((error) => console.error('[messages] fallo en la purga de retención:', error.message));
  retentionInterval = setInterval(() => {
    purgeOldMessages().catch((error) => console.error('[messages] fallo en la purga de retención:', error.message));
  }, 24 * 60 * 60 * 1000);
  retentionInterval.unref?.();
}

export function stopMessageRetention() {
  if (retentionInterval) {
    clearInterval(retentionInterval);
    retentionInterval = null;
  }
}
