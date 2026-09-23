import { Router } from 'express';
import { withUser } from './db.js';
import { requireSession } from './auth.js';
import {
  POST_SELECT, POST_JOINS, POST_VISIBLE, PAGE_DEFAULT,
  httpError, sendError, parseBefore, page,
} from './community.js';

/**
 * Perfiles públicos: /users/:publicId.
 *
 * Solo tienen perfil público quienes eligieron un nombre, y nada de lo
 * anónimo aparece aquí — ni en la lista de publicaciones ni en los conteos.
 * `profiles` sigue dejando leer solo la fila propia; todo esto sale de las
 * funciones security definer de la migración …_public_functions, que reciben
 * el public_id y nunca devuelven el id interno de nadie.
 */

export const usersRouter = Router();
usersRouter.use(requireSession);

// Los public_id los genera la base (public.gen_public_id): 10 caracteres de
// un alfabeto en minúsculas. Cualquier otra cosa no existe.
usersRouter.param('publicId', (req, res, next, value) => {
  if (!/^[a-z0-9]{4,32}$/.test(value)) return res.status(404).json({ error: 'not_found' });
  next();
});

async function loadProfile(client, publicId) {
  const { rows } = await client.query('select * from public.public_profile($1)', [publicId]);
  if (!rows[0]) throw httpError(404, 'not_found');
  return rows[0];
}

usersRouter.get('/:publicId', async (req, res, next) => {
  try {
    const user = await withUser(req.userId, (client) => loadProfile(client, req.params.publicId));
    res.json({ user });
  } catch (error) {
    sendError(res, next, error);
  }
});

usersRouter.get('/:publicId/posts', async (req, res, next) => {
  try {
    const before = parseBefore(req.query.before);
    const rows = await withUser(req.userId, async (client) => {
      await loadProfile(client, req.params.publicId);
      // La función entrega solo ids de lo publicado CON NOMBRE; el objeto
      // Post se arma por el camino normal, así que RLS y los bloqueos
      // vuelven a aplicar.
      const result = await client.query(
        `select ${POST_SELECT} from public.posts p ${POST_JOINS}
          where p.id in (select id from public.public_user_post_ids($1, $2::timestamptz, $3))
            and ${POST_VISIBLE}
          order by p.created_at desc`,
        [req.params.publicId, before, PAGE_DEFAULT]
      );
      return result.rows;
    });
    res.json(page(rows, PAGE_DEFAULT));
  } catch (error) {
    sendError(res, next, error);
  }
});

usersRouter.post('/:publicId/follow', async (req, res, next) => {
  try {
    await withUser(req.userId, (client) =>
      client.query('select public.follow_user($1)', [req.params.publicId]));
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

usersRouter.delete('/:publicId/follow', async (req, res, next) => {
  try {
    await withUser(req.userId, (client) =>
      client.query('select public.unfollow_user($1)', [req.params.publicId]));
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

usersRouter.post('/:publicId/block', async (req, res, next) => {
  try {
    const block = await withUser(req.userId, async (client) => {
      const { rows } = await client.query('select public.block_user($1) as id', [req.params.publicId]);
      const result = await client.query(
        'select id, created_at, label from public.blocks where id = $1',
        [rows[0].id]
      );
      return result.rows[0];
    });
    res.json({ ok: true, block });
  } catch (error) {
    sendError(res, next, error);
  }
});
