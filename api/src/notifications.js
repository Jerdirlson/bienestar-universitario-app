import { Router } from 'express';
import { withUser } from './db.js';
import { requireSession } from './auth.js';
import { httpError, sendError, isUuid, parseBefore, cursorSql } from './community.js';

/**
 * Notificaciones de la persona. Las crean triggers de la base y el panel de
 * administración; aquí solo se leen y se marcan como leídas.
 *
 * `actor` sale de public.notification_actor(), que devuelve null si quien
 * actuó lo hizo de forma anónima. actor_id ni siquiera es legible desde el
 * cliente (grant por columnas).
 */

const PAGE = 30;

export const notificationsRouter = Router();
notificationsRouter.use(requireSession);

async function unreadCount(client) {
  const { rows } = await client.query(
    'select count(*)::int as n from public.notifications where recipient_id = auth.uid() and read_at is null'
  );
  return rows[0].n;
}

notificationsRouter.get('/', async (req, res, next) => {
  try {
    const before = parseBefore(req.query.before);
    const data = await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `select n.id, n.kind, n.post_id, n.comment_id, n.reaction_kind,
                public.notification_actor(n.id) as actor,
                n.excerpt, n.created_at, (n.read_at is not null) as read,
                ${cursorSql('n.created_at')} as _cursor
           from public.notifications n
          where n.recipient_id = auth.uid()
            and ($1::timestamptz is null or n.created_at < $1::timestamptz)
          order by n.created_at desc
          limit $2`,
        [before, PAGE]
      );
      return { rows, unread: await unreadCount(client) };
    });
    res.json({
      notifications: data.rows.map(({ _cursor, ...n }) => ({ ...n, actor: n.actor ?? null })),
      unread: data.unread,
      next_before: data.rows.length === PAGE ? data.rows[data.rows.length - 1]._cursor : null,
    });
  } catch (error) {
    sendError(res, next, error);
  }
});

notificationsRouter.get('/unread-count', async (req, res, next) => {
  try {
    const unread = await withUser(req.userId, unreadCount);
    res.json({ unread });
  } catch (error) {
    sendError(res, next, error);
  }
});

notificationsRouter.post('/read', async (req, res, next) => {
  try {
    const ids = req.body?.ids;
    if (ids !== undefined && (!Array.isArray(ids) || ids.length > 500 || !ids.every(isUuid))) {
      throw httpError(400, 'solicitud_invalida');
    }
    const unread = await withUser(req.userId, async (client) => {
      await client.query(
        `update public.notifications set read_at = now()
          where recipient_id = auth.uid() and read_at is null
            and ($1::uuid[] is null or id = any($1::uuid[]))`,
        [ids ?? null]
      );
      return unreadCount(client);
    });
    res.json({ ok: true, unread });
  } catch (error) {
    sendError(res, next, error);
  }
});
