import { Router } from 'express';
import { withUser, withServiceRole } from './db.js';
import { requireSession } from './auth.js';
import { broadcastQueueChanged } from './realtime.js';
import { isUuid } from './community.js';

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
// Lo retenido por crisis primero (risk = 'high'), después lo demás por orden
// de llegada. Se lee como el administrador (withUser): las políticas
// *_select_moderator ya le dejan ver lo pendiente y los reportes. Nunca se
// incluye nada del diario — no hay política que lo permita, ni aquí ni en
// ningún lado.

adminRouter.get('/queue', async (req, res, next) => {
  try {
    const { posts, comments } = await withUser(req.userId, async (client) => {
      const p = await client.query(
        `select p.id, p.body, p.mood, p.topic, p.status, p.risk, p.screening_note, p.held_reason,
                p.created_at, p.edited_at, p.is_anonymous, p.author_display_name,
                (select count(*)::int from public.post_reports r
                  where r.post_id = p.id and r.resolved_at is null) as report_count
           from public.posts p where p.status = 'pending'
           order by (p.risk = 'high') desc, p.created_at asc`
      );
      const c = await client.query(
        `select c.id, c.post_id, c.parent_id, c.body, c.status, c.risk, c.screening_note, c.held_reason,
                c.created_at, c.is_anonymous, c.author_display_name,
                (select count(*)::int from public.comment_reports r
                  where r.comment_id = c.id and r.resolved_at is null) as report_count
           from public.post_comments c where c.status = 'pending'
           order by (c.risk = 'high') desc, c.created_at asc`
      );
      return { posts: p.rows, comments: c.rows };
    });
    res.json({ posts, comments });
  } catch (error) {
    next(error);
  }
});

const MODERATION = {
  publish: { from: ['pending'], to: 'published' },
  reject:  { from: ['pending'], to: 'rejected' },
  // Quitar algo que ya estaba publicado (o retenido): deja de verse para
  // todos salvo su autor, igual que un rechazo.
  remove:  { from: ['pending', 'published'], to: 'removed' },
};

const NOTIFY_KIND = {
  posts:         { publish: 'post_approved', reject: 'post_rejected', remove: 'post_rejected' },
  post_comments: { publish: 'comment_approved', reject: 'comment_rejected', remove: 'comment_rejected' },
};

/**
 * Aprobar, rechazar o quitar una publicación o un comentario.
 *
 * La política de posts NO concede update a authenticated a propósito
 * ("Moderar es cosa de service_role" — row_level_security.sql), así que esto
 * usa withServiceRole. requireAdmin ya corrió antes con la identidad real —
 * adentro de la transacción de service_role ya no hay auth.uid(), por eso el
 * id del administrador se pasa explícito.
 *
 * En la misma transacción: cambia el estado, cierra los reportes abiertos
 * (ya se decidió), deja constancia en moderation_actions y avisa al autor.
 * Si el contenido no estaba en un estado moderable (ya decidido, borrado),
 * 409 y no se registra nada.
 */
async function moderate(table, id, action, adminId) {
  const rule = MODERATION[action];
  const isPost = table === 'posts';
  return withServiceRole(async (client) => {
    const { rows } = await client.query(
      `update public.${table}
          set status = $2::public.post_status, held_reason = null, screened_at = coalesce(screened_at, now())
        where id = $1 and status = any($3::public.post_status[])
        returning id, author_id, body${isPost ? '' : ', post_id'}`,
      [id, rule.to, rule.from]
    );
    const row = rows[0];
    if (!row) return false;

    await client.query(
      `update public.${isPost ? 'post_reports' : 'comment_reports'}
          set resolved_at = now(), resolved_by = $2
        where ${isPost ? 'post_id' : 'comment_id'} = $1 and resolved_at is null`,
      [id, adminId]
    );

    // moderation_actions.post_id apunta a posts — un comentario no tiene
    // fila propia ahí, la nota deja constancia de cuál fue.
    await client.query(
      `insert into public.moderation_actions (post_id, moderator_id, action, note)
         values ($1, $2, $3, $4)`,
      [isPost ? id : null, adminId, action, isPost ? null : `comentario ${id}`]
    );

    // Las notificaciones que apuntaban a lo rechazado o quitado (reacciones,
    // comentarios, "me gusta") ya las borró el trigger
    // *_withdrawn_purge_notifications al cambiar el estado (migración
    // …_security_review). Queda solo el aviso de la decisión a su autor.
    await client.query(
      `insert into public.notifications (recipient_id, kind, post_id, comment_id, actor_visible, excerpt)
         values ($1, $2, $3, $4, false, public.excerpt($5))`,
      [row.author_id, NOTIFY_KIND[table][action], isPost ? row.id : row.post_id, isPost ? null : row.id, row.body]
    );
    return true;
  });
}

function moderateRoute(table) {
  return async (req, res, next) => {
    try {
      const action = req.body?.action;
      if (!Object.hasOwn(MODERATION, action ?? '')) {
        return res.status(400).json({ error: 'accion_invalida' });
      }
      if (!isUuid(req.params.id)) return res.status(404).json({ error: 'not_found' });

      const changed = await moderate(table, req.params.id, action, req.userId);
      if (!changed) return res.status(409).json({ error: 'estado_invalido' });

      broadcastQueueChanged();
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  };
}

adminRouter.post('/posts/:id/moderate', moderateRoute('posts'));
adminRouter.post('/comments/:id/moderate', moderateRoute('post_comments'));

// ── reportes ────────────────────────────────────────────────────────────
// Quién reportó NO se entrega: el panel decide sobre el contenido, no sobre
// quién lo señaló.

adminRouter.get('/reports', async (req, res, next) => {
  try {
    const reports = await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `select r.id, 'post' as target, r.post_id, null::uuid as comment_id, r.reason, r.detail, r.created_at,
                p.body, p.status, p.held_reason, p.risk,
                (select count(*)::int from public.post_reports r2
                  where r2.post_id = r.post_id and r2.resolved_at is null) as report_count
           from public.post_reports r join public.posts p on p.id = r.post_id
          where r.resolved_at is null
         union all
         select r.id, 'comment', c.post_id, r.comment_id, r.reason, r.detail, r.created_at,
                c.body, c.status, c.held_reason, c.risk,
                (select count(*)::int from public.comment_reports r2
                  where r2.comment_id = r.comment_id and r2.resolved_at is null)
           from public.comment_reports r join public.post_comments c on c.id = r.comment_id
          where r.resolved_at is null
          order by created_at asc`
      );
      return rows;
    });
    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

/**
 * Descartar un reporte. Si con eso el contenido se queda sin reportes
 * abiertos y estaba oculto SOLO por el umbral de reportes, vuelve a
 * publicarse: los reportes eran la única razón para ocultarlo.
 */
adminRouter.post('/reports/:id/dismiss', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'not_found' });

    const result = await withServiceRole(async (client) => {
      for (const [reports, content, fk] of [
        ['post_reports', 'posts', 'post_id'],
        ['comment_reports', 'post_comments', 'comment_id'],
      ]) {
        const { rows } = await client.query(
          `update public.${reports} set resolved_at = now(), resolved_by = $2
            where id = $1 and resolved_at is null
            returning ${fk} as target`,
          [req.params.id, req.userId]
        );
        if (!rows[0]) continue;
        const target = rows[0].target;

        const restored = await client.query(
          `update public.${content} set status = 'published', held_reason = null
            where id = $1 and status = 'pending' and held_reason = 'reports'
              and not exists (select 1 from public.${reports} r
                               where r.${fk} = $1 and r.resolved_at is null)`,
          [target]
        );
        await client.query(
          `insert into public.moderation_actions (post_id, moderator_id, action, note)
             values ($1, $2, 'dismiss_report', $3)`,
          [content === 'posts' ? target : null, req.userId,
            content === 'posts' ? `reporte ${req.params.id}` : `reporte ${req.params.id} de comentario ${target}`]
        );
        return { restored: restored.rowCount > 0 };
      }
      return null;
    });

    if (!result) return res.status(404).json({ error: 'not_found' });
    broadcastQueueChanged();
    res.json({ ok: true, restored: result.restored });
  } catch (error) {
    next(error);
  }
});

// ── estadísticas ────────────────────────────────────────────────────────
// Conteos generales para el panel. NUNCA nada del diario (ni de entries ni
// de journal_entries, ni por persona ni en total): service_role ni siquiera
// tiene grant sobre esas tablas.

adminRouter.get('/stats', async (req, res, next) => {
  try {
    const stats = await withServiceRole(async (client) => {
      const byStatus = async (table) => {
        const { rows } = await client.query(
          `select status::text as status, count(*)::int as n from public.${table} group by status`
        );
        const out = { pending: 0, published: 0, rejected: 0, removed: 0 };
        for (const r of rows) out[r.status] = r.n;
        return out;
      };
      const one = async (sql) => (await client.query(sql)).rows[0].n;
      return {
        users: await one('select count(*)::int as n from auth.users'),
        users_with_name: await one('select count(*)::int as n from public.profiles where display_name is not null'),
        posts: await byStatus('posts'),
        comments: await byStatus('post_comments'),
        open_reports: await one(`select ((select count(*) from public.post_reports where resolved_at is null)
                                        + (select count(*) from public.comment_reports where resolved_at is null))::int as n`),
        crisis_pending: await one(`select ((select count(*) from public.posts where status = 'pending' and held_reason = 'crisis')
                                          + (select count(*) from public.post_comments where status = 'pending' and held_reason = 'crisis'))::int as n`),
        posts_last_7_days: await one(`select count(*)::int as n from public.posts where created_at > now() - interval '7 days'`),
      };
    });
    res.json(stats);
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
