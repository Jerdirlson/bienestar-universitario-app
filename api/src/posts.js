import { Router } from 'express';
import { withUser } from './db.js';
import { requireSession } from './auth.js';
import { broadcastQueueChanged } from './realtime.js';

/**
 * Comunidad — lo que ve y hace la app móvil. Publicaciones y comentarios
 * comparten el mismo principio: nada se publica solo (ver initial_schema.sql)
 * y quien escribe puede elegir firmar con su alias de perfil o quedar
 * anónime — nunca con su identidad institucional, que no vive en estas
 * tablas.
 *
 * Deliberadamente SIN moderación acá: aprobar/rechazar es cosa exclusiva del
 * panel de administración (ver admin.js), que exige is_admin() — no
 * is_moderator() — y nunca se expone a través de este router. La app móvil
 * no tiene ningún camino, ni oculto, para publicar algo por sí sola.
 *
 * Todo esto pasa por withUser y confía en las políticas de la base para
 * decidir qué se ve y qué se puede escribir — este archivo no reimplementa
 * esas reglas, solo arma las consultas.
 */

const MOOD_MIN = 0;
const MOOD_MAX = 4;
const BODY_MAX = 2000;
const COMMENT_MAX = 1000;
const REPORT_REASONS = ['self_harm', 'harassment', 'spam', 'personal_info', 'other'];

export const postsRouter = Router();
postsRouter.use(requireSession);

/**
 * Resuelve con qué nombre firma esto. Anónime → null. Con nombre → el
 * display_name YA guardado en el perfil (profiles_select_own permite leer el
 * propio) — si todavía no le puso nombre, no puede publicar como sí mismo:
 * mejor un error claro que un post firmado "null".
 */
async function resolveAuthorName(client, isAnonymous) {
  if (isAnonymous) return null;
  const { rows } = await client.query('select display_name from public.profiles where id = auth.uid()');
  const name = rows[0]?.display_name;
  if (!name) {
    const error = new Error('falta_nombre');
    error.httpStatus = 400;
    error.code = 'falta_nombre';
    throw error;
  }
  return name;
}

function handleError(res, next, error) {
  if (error.httpStatus) return res.status(error.httpStatus).json({ error: error.code });
  next(error);
}

// ── publicaciones ────────────────────────────────────────────────────────

/**
 * El feed: RLS ya devuelve exactamente lo que esta persona puede ver
 * (publicados de cualquiera + propios en cualquier estado + todo si es
 * moderador) — por eso el select no filtra por status, la base lo hace.
 */
postsRouter.get('/', async (req, res, next) => {
  try {
    const posts = await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `select
           p.id, p.body, p.mood, p.status, p.created_at,
           case when p.is_anonymous then null else p.author_display_name end as author_name,
           (p.author_id = $1) as is_own,
           (select count(*)::int from public.post_reactions r where r.post_id = p.id) as reactions,
           exists(
             select 1 from public.post_reactions r2
             where r2.post_id = p.id and r2.user_id = $1
           ) as reacted_by_me,
           (select count(*)::int from public.post_comments c
              where c.post_id = p.id and c.status = 'published') as comment_count
         from public.posts p
         order by p.created_at desc
         limit 100`,
        [req.userId]
      );
      return rows;
    });
    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

postsRouter.post('/', async (req, res, next) => {
  try {
    const body = String(req.body?.body ?? '').trim();
    const mood = req.body?.mood;
    const isAnonymous = req.body?.isAnonymous !== false; // por defecto, anónime
    if (!body || body.length > BODY_MAX) {
      return res.status(400).json({ error: 'texto_invalido' });
    }
    if (mood !== undefined && mood !== null && (!Number.isInteger(mood) || mood < MOOD_MIN || mood > MOOD_MAX)) {
      return res.status(400).json({ error: 'mood_invalido' });
    }

    // status/risk/screened_at no se mandan: sus valores por defecto ('pending',
    // 'unscreened', null) son justo los que exige posts_insert_own_pending —
    // mandarlos explícitos y distintos haría que la base rechace el insert.
    const post = await withUser(req.userId, async (client) => {
      const authorName = await resolveAuthorName(client, isAnonymous);
      const { rows } = await client.query(
        `insert into public.posts (author_id, body, mood, is_anonymous, author_display_name)
           values ($1, $2, $3, $4, $5)
           returning id, body, mood, status, created_at, is_anonymous, author_display_name`,
        [req.userId, body, mood ?? null, isAnonymous, authorName]
      );
      return rows[0];
    });

    broadcastQueueChanged();
    res.status(201).json({
      post: {
        id: post.id, body: post.body, mood: post.mood, status: post.status, created_at: post.created_at,
        author_name: post.is_anonymous ? null : post.author_display_name,
        is_own: true, reactions: 0, reacted_by_me: false, comment_count: 0,
      },
    });
  } catch (error) {
    handleError(res, next, error);
  }
});

postsRouter.delete('/:id', async (req, res, next) => {
  try {
    await withUser(req.userId, async (client) => {
      await client.query('delete from public.posts where id = $1', [req.params.id]);
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

postsRouter.post('/:id/react', async (req, res, next) => {
  try {
    await withUser(req.userId, async (client) => {
      // Sin on conflict do nothing quedaría un error si se toca dos veces
      // seguido (doble tap) — mejor idempotente que un 500 por una carrera
      // del lado del cliente.
      await client.query(
        `insert into public.post_reactions (post_id, user_id) values ($1, $2)
           on conflict (post_id, user_id) do nothing`,
        [req.params.id, req.userId]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

postsRouter.delete('/:id/react', async (req, res, next) => {
  try {
    await withUser(req.userId, async (client) => {
      await client.query(
        'delete from public.post_reactions where post_id = $1 and user_id = $2',
        [req.params.id, req.userId]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

postsRouter.post('/:id/report', async (req, res, next) => {
  try {
    const reason = req.body?.reason;
    const detail = req.body?.detail ? String(req.body.detail).slice(0, 1000) : null;
    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ error: 'razon_invalida' });
    }

    await withUser(req.userId, async (client) => {
      await client.query(
        `insert into public.post_reports (post_id, reporter_id, reason, detail)
           values ($1, $2, $3, $4)
           on conflict (post_id, reporter_id) do nothing`,
        [req.params.id, req.userId, reason, detail]
      );
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ── comentarios ──────────────────────────────────────────────────────────
// Mismas reglas que las publicaciones: nace pending, elige nombre o anonimato,
// y comments_insert_own (post_comments.sql) exige que el post ya esté
// publicado — no se comenta en algo que nadie más puede ver todavía.

postsRouter.get('/:id/comments', async (req, res, next) => {
  try {
    const comments = await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `select
           c.id, c.body, c.status, c.created_at,
           case when c.is_anonymous then null else c.author_display_name end as author_name,
           (c.author_id = $1) as is_own
         from public.post_comments c
         where c.post_id = $2
         order by c.created_at asc`,
        [req.userId, req.params.id]
      );
      return rows;
    });
    res.json({ comments });
  } catch (error) {
    next(error);
  }
});

postsRouter.post('/:id/comments', async (req, res, next) => {
  try {
    const body = String(req.body?.body ?? '').trim();
    const isAnonymous = req.body?.isAnonymous !== false;
    if (!body || body.length > COMMENT_MAX) {
      return res.status(400).json({ error: 'texto_invalido' });
    }

    const comment = await withUser(req.userId, async (client) => {
      const authorName = await resolveAuthorName(client, isAnonymous);
      const { rows } = await client.query(
        `insert into public.post_comments (post_id, author_id, body, is_anonymous, author_display_name)
           values ($1, $2, $3, $4, $5)
           returning id, body, status, created_at, is_anonymous, author_display_name`,
        [req.params.id, req.userId, body, isAnonymous, authorName]
      );
      return rows[0];
    });

    broadcastQueueChanged();
    res.status(201).json({
      comment: {
        id: comment.id, body: comment.body, status: comment.status, created_at: comment.created_at,
        author_name: comment.is_anonymous ? null : comment.author_display_name,
        is_own: true,
      },
    });
  } catch (error) {
    handleError(res, next, error);
  }
});

postsRouter.delete('/comments/:id', async (req, res, next) => {
  try {
    await withUser(req.userId, async (client) => {
      await client.query('delete from public.post_comments where id = $1', [req.params.id]);
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
