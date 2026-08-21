import { Router } from 'express';
import { withUser, withServiceRole } from './db.js';
import { requireSession } from './auth.js';
import { broadcastQueueChanged } from './realtime.js';

/**
 * Todo lo que solo un administrador puede hacer: moderar (aprobar/rechazar
 * publicaciones y comentarios) y editar el contenido de Explorar. Vive
 * separado de posts.js/explore.js a propósito — la app móvil nunca importa
 * ni expone este router; solo lo usa el panel web de administración.
 *
 * is_admin() es más estricto que is_moderator() (que sigue existiendo, mira
 * 'moderator' o 'admin'): acá exigimos 'admin' específicamente, porque
 * quedó decidido que moderar y administrar Explorar es un panel aparte, no
 * una función de la app que cualquier moderador pueda tocar desde el
 * teléfono.
 */

const CATEGORIES = ['live_well', 'relieve_stress', 'relations', 'mindfulness'];
const PLATFORMS = ['Instagram', 'YouTube'];
const ROLES = ['student', 'moderator', 'professional', 'admin'];

export const adminRouter = Router();
adminRouter.use(requireSession);

async function requireAdmin(req, res, next) {
  const ok = await withUser(req.userId, async (client) => {
    const { rows } = await client.query('select public.is_admin() as ok');
    return rows[0].ok;
  }).catch(() => false);

  if (!ok) return res.status(403).json({ error: 'no_autorizado' });
  next();
}

adminRouter.use(requireAdmin);

// ── cola de moderación ──────────────────────────────────────────────────

adminRouter.get('/queue', async (req, res, next) => {
  try {
    const { posts, comments } = await withUser(req.userId, async (client) => {
      const p = await client.query(
        `select id, body, mood, status, risk, created_at, is_anonymous, author_display_name
           from public.posts where status = 'pending'
           order by created_at asc`
      );
      const c = await client.query(
        `select id, post_id, body, status, risk, created_at, is_anonymous, author_display_name
           from public.post_comments where status = 'pending'
           order by created_at asc`
      );
      return { posts: p.rows, comments: c.rows };
    });
    res.json({ posts, comments });
  } catch (error) {
    next(error);
  }
});

/**
 * La política de posts NO concede update a authenticated a propósito
 * ("Moderar es cosa de service_role" — row_level_security.sql), así que
 * esto usa withServiceRole. requireAdmin ya corrió antes con la identidad
 * real — adentro de la transacción de service_role ya no hay auth.uid().
 */
adminRouter.post('/posts/:id/moderate', async (req, res, next) => {
  try {
    const action = req.body?.action;
    if (!['publish', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'accion_invalida' });
    }

    const newStatus = action === 'publish' ? 'published' : 'rejected';
    await withServiceRole(async (client) => {
      await client.query(
        `update public.posts set status = $1, risk = 'none', screened_at = now()
           where id = $2 and status = 'pending'`,
        [newStatus, req.params.id]
      );
      await client.query(
        `insert into public.moderation_actions (post_id, moderator_id, action)
           values ($1, $2, $3)`,
        [req.params.id, req.userId, action]
      );
    });

    broadcastQueueChanged();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/comments/:id/moderate', async (req, res, next) => {
  try {
    const action = req.body?.action;
    if (!['publish', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'accion_invalida' });
    }

    const newStatus = action === 'publish' ? 'published' : 'rejected';
    await withServiceRole(async (client) => {
      await client.query(
        `update public.post_comments set status = $1, risk = 'none', screened_at = now()
           where id = $2 and status = 'pending'`,
        [newStatus, req.params.id]
      );
      // moderation_actions.post_id apunta a posts — un comentario no tiene
      // fila propia ahí, la nota deja constancia de cuál fue.
      await client.query(
        `insert into public.moderation_actions (moderator_id, action, note)
           values ($1, $2, $3)`,
        [req.userId, action, `comentario ${req.params.id}`]
      );
    });

    broadcastQueueChanged();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ── Explorar ─────────────────────────────────────────────────────────────

adminRouter.get('/explore', async (req, res, next) => {
  try {
    const resources = await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `select id, category, title, platform, url, image_url, position
           from public.explore_resources order by category, position`
      );
      return rows;
    });
    res.json({ resources });
  } catch (error) {
    next(error);
  }
});

function validateResource(body) {
  const { category, title, platform, url } = body ?? {};
  if (!CATEGORIES.includes(category)) return 'categoria_invalida';
  if (!PLATFORMS.includes(platform)) return 'plataforma_invalida';
  if (typeof title !== 'string' || title.trim().length < 1 || title.length > 100) return 'titulo_invalido';
  if (typeof url !== 'string' || !/^https:\/\//.test(url) || url.length > 500) return 'url_invalida';
  return null;
}

adminRouter.post('/explore', async (req, res, next) => {
  try {
    const error = validateResource(req.body);
    if (error) return res.status(400).json({ error });
    const { category, title, platform, url, imageUrl, position } = req.body;

    const resource = await withServiceRole(async (client) => {
      const { rows } = await client.query(
        `insert into public.explore_resources (category, title, platform, url, image_url, position)
           values ($1, $2, $3, $4, $5, $6)
           returning id, category, title, platform, url, image_url, position`,
        [category, title.trim(), platform, url, imageUrl ?? null, position ?? 0]
      );
      return rows[0];
    });
    res.status(201).json({ resource });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/explore/:id', async (req, res, next) => {
  try {
    const error = validateResource({ ...req.body, category: req.body.category, platform: req.body.platform });
    if (error) return res.status(400).json({ error });
    const { category, title, platform, url, imageUrl, position } = req.body;

    await withServiceRole(async (client) => {
      await client.query(
        `update public.explore_resources
           set category = $1, title = $2, platform = $3, url = $4, image_url = $5, position = $6
           where id = $7`,
        [category, title.trim(), platform, url, imageUrl ?? null, position ?? 0, req.params.id]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/explore/:id', async (req, res, next) => {
  try {
    await withServiceRole(async (client) => {
      await client.query('delete from public.explore_resources where id = $1', [req.params.id]);
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ── usuarios ─────────────────────────────────────────────────────────────
// authenticated no puede leer perfiles ni auth.users ajenos (RLS: cada quien
// solo ve el propio) — por eso todo esto va por service_role, igual que
// moderar. requireAdmin ya corrió con la identidad real antes de llegar acá.

adminRouter.get('/users', async (req, res, next) => {
  try {
    const users = await withServiceRole(async (client) => {
      const { rows } = await client.query(
        `select u.id, u.email, u.created_at, u.last_seen_at, p.display_name, p.role
           from auth.users u join public.profiles p on p.id = u.id
           order by u.created_at desc`
      );
      return rows;
    });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/users/:id/role', async (req, res, next) => {
  try {
    const role = req.body?.role;
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'rol_invalido' });

    await withServiceRole(async (client) => {
      await client.query('update public.profiles set role = $1 where id = $2', [role, req.params.id]);
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'no_puede_borrarse_a_si_mismo' });
    }

    await withServiceRole(async (client) => {
      await client.query('delete from auth.users where id = $1', [req.params.id]);
    });
    res.json({ ok: true });
  } catch (error) {
    // moderation_actions.moderator_id es on delete restrict: si esta cuenta
    // moderó algo, Postgres rechaza el borrado con una violación de llave
    // foránea en vez de vaciar la bitácora — es la respuesta correcta, no un
    // error real del API, así que se traduce a un mensaje claro.
    if (error.code === '23503') {
      return res.status(409).json({ error: 'tiene_historial_de_moderacion' });
    }
    next(error);
  }
});
