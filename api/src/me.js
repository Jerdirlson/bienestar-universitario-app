import { Router } from 'express';
import { withUser } from './db.js';
import { requireSession } from './auth.js';
import {
  POST_SELECT, POST_JOINS, POST_VISIBLE, PAGE_DEFAULT,
  sendError, uuidParam, parseBefore, page, cursorSql,
} from './community.js';

/**
 * Lo mío: publicaciones propias, guardados y bloqueos. Todo por withUser; las
 * políticas de saved_posts y blocks solo dejan ver las filas propias, así que
 * aunque la consulta se equivocara no podría traer lo de otra persona.
 */

export const meRouter = Router();
meRouter.use(requireSession);
meRouter.param('id', uuidParam);

meRouter.get('/posts', async (req, res, next) => {
  try {
    const before = parseBefore(req.query.before);
    const rows = await withUser(req.userId, async (client) => {
      const result = await client.query(
        `select ${POST_SELECT} from public.posts p ${POST_JOINS}
          where p.author_id = auth.uid()
            and ($1::timestamptz is null or p.created_at < $1::timestamptz)
          order by p.created_at desc
          limit $2`,
        [before, PAGE_DEFAULT]
      );
      return result.rows;
    });
    res.json(page(rows, PAGE_DEFAULT));
  } catch (error) {
    sendError(res, next, error);
  }
});

// Guardadas que todavía puedo ver: si la publicación se ocultó, se rechazó o
// su autor quedó bloqueado, desaparece de la lista sin borrar el guardado.
meRouter.get('/saved', async (req, res, next) => {
  try {
    const before = parseBefore(req.query.before);
    const rows = await withUser(req.userId, async (client) => {
      const result = await client.query(
        `select ${POST_SELECT}, ${cursorSql('s.created_at')} as _saved_cursor
           from public.saved_posts s
           join public.posts p on p.id = s.post_id
           ${POST_JOINS}
          where s.user_id = auth.uid()
            and ${POST_VISIBLE}
            and ($1::timestamptz is null or s.created_at < $1::timestamptz)
          order by s.created_at desc
          limit $2`,
        [before, PAGE_DEFAULT]
      );
      return result.rows;
    });
    res.json(page(rows, PAGE_DEFAULT, '_saved_cursor'));
  } catch (error) {
    sendError(res, next, error);
  }
});

// blocked_id no es legible desde el cliente (grant por columnas): esta lista
// no puede decir a quién corresponde un bloqueo hecho desde algo anónimo.
meRouter.get('/blocks', async (req, res, next) => {
  try {
    const blocks = await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `select id, created_at, label from public.blocks
          where blocker_id = auth.uid()
          order by created_at desc`
      );
      return rows;
    });
    res.json({ blocks });
  } catch (error) {
    sendError(res, next, error);
  }
});

meRouter.delete('/blocks/:id', async (req, res, next) => {
  try {
    await withUser(req.userId, (client) =>
      client.query('delete from public.blocks where id = $1', [req.params.id]));
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

// ── notificaciones push (api/src/push.js) ───────────────────────────────────
// Un token de Expo por dispositivo. Nunca falla ruidoso: registrar el token
// es un efecto secundario del login, no algo que deba tumbar la sesión si el
// cuerpo llega mal formado.

meRouter.get('/push-settings', async (req, res, next) => {
  try {
    const enabled = await withUser(req.userId, async (client) => {
      const { rows } = await client.query('select push_enabled from public.profiles where id = auth.uid()');
      return !!rows[0]?.push_enabled;
    });
    res.json({ enabled });
  } catch (error) {
    sendError(res, next, error);
  }
});

meRouter.put('/push-settings', async (req, res, next) => {
  try {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'valor_invalido' });
    await withUser(req.userId, (client) =>
      client.query('update public.profiles set push_enabled = $1 where id = auth.uid()', [enabled]));
    res.json({ ok: true, enabled });
  } catch (error) {
    sendError(res, next, error);
  }
});

meRouter.post('/push-token', async (req, res, next) => {
  try {
    const token = req.body?.token;
    if (typeof token !== 'string' || token.trim() === '' || token.length > 200) {
      return res.status(400).json({ error: 'token_invalido' });
    }
    await withUser(req.userId, (client) =>
      client.query(
        `insert into public.push_tokens (user_id, token) values (auth.uid(), $1)
           on conflict (user_id, token) do nothing`,
        [token.trim()]
      ));
    res.status(201).json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

meRouter.delete('/push-token', async (req, res, next) => {
  try {
    const token = req.body?.token;
    await withUser(req.userId, (client) =>
      client.query(
        `delete from public.push_tokens
          where user_id = auth.uid() and ($1::text is null or token = $1::text)`,
        [typeof token === 'string' && token.trim() !== '' ? token.trim() : null]
      ));
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});
