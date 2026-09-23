import { Router } from 'express';
import { withUser, withServiceRole } from './db.js';
import { requireSession } from './auth.js';
import { config } from './config.js';
import { screen } from './moderation.js';
import { broadcastQueueChanged } from './realtime.js';
import {
  TOPICS, REACTION_KINDS, REPORT_REASONS, BODY_MAX, COMMENT_MAX,
  POST_SELECT, POST_JOINS, POST_VISIBLE, COMMENT_SELECT,
  httpError, sendError, uuidParam, isUuid, parseLimit, parseBefore,
  mapPost, mapComment, fetchPost, fetchComment, applyScreening,
  foldForSearch, FOLD_SQL,
} from './community.js';

/**
 * Comunidad — lo que ve y hace la app móvil (contrato v2, ver api/API.md).
 *
 * Nada se publica solo: todo nace 'pending' (la política de insert lo exige)
 * y después pasa por el filtro automático (moderation.js) vía
 * applyScreening(). Lo que no tiene riesgo se publica en el acto; lo
 * riesgoso queda retenido para revisión humana en el panel de administración.
 * Quien escribe elige firmar con su alias de perfil o quedar anónimo — nunca
 * con su identidad institucional, que no vive en estas tablas.
 *
 * Aprobar, rechazar o quitar es cosa exclusiva del panel (admin.js), que
 * exige is_admin() y nunca se expone por este router. La app móvil no tiene
 * ningún camino, ni oculto, para saltarse el filtro.
 *
 * Todo pasa por withUser y confía en las políticas de la base para decidir
 * qué se ve y qué se puede escribir. withServiceRole solo aparece para
 * aplicar el filtro, después de que withUser comprobó que la fila es de quien
 * llama.
 */

const MOOD_MIN = 0;
const MOOD_MAX = 4;

export const postsRouter = Router();
postsRouter.use(requireSession);
postsRouter.param('id', uuidParam);

/**
 * Resuelve con qué nombre firma esto. Anónimo → null. Con nombre → el
 * display_name YA guardado en el perfil (profiles_select_own permite leer el
 * propio) — si todavía no le puso nombre, no puede publicar como sí mismo:
 * mejor un error claro que un post firmado "null".
 */
async function resolveAuthorName(client, isAnonymous) {
  if (isAnonymous) return null;
  const { rows } = await client.query('select display_name from public.profiles where id = auth.uid()');
  const name = rows[0]?.display_name;
  if (!name) throw httpError(400, 'falta_nombre');
  return name;
}

/**
 * Límite de frecuencia contado en la base (no en memoria): sobrevive a
 * reinicios y funcionaría igual con varias instancias del API.
 */
async function enforceRate(client, table, limit, code) {
  const { rows } = await client.query(
    `select count(*)::int as n from public.${table}
      where author_id = auth.uid() and created_at > now() - interval '1 hour'`
  );
  if (rows[0].n >= limit) throw httpError(429, code);
}

function validMood(mood) {
  return mood === undefined || mood === null || (Number.isInteger(mood) && mood >= MOOD_MIN && mood <= MOOD_MAX);
}

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// ── feed ─────────────────────────────────────────────────────────────────

postsRouter.get('/', async (req, res, next) => {
  try {
    const feed = req.query.feed ?? 'all';
    const sort = req.query.sort ?? 'recent';
    const topic = req.query.topic || null;
    if (!['all', 'following'].includes(feed) || !['recent', 'popular'].includes(sort)) {
      throw httpError(400, 'solicitud_invalida');
    }
    if (topic && !TOPICS.includes(topic)) throw httpError(400, 'tema_invalido');
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const limit = parseLimit(req.query.limit);
    const before = parseBefore(req.query.before);
    const offset = sort === 'popular'
      ? Math.min(Math.max(Number.parseInt(req.query.offset, 10) || 0, 0), 1000)
      : 0;

    const params = [];
    const add = (value) => { params.push(value); return `$${params.length}`; };
    const where = [POST_VISIBLE];

    if (topic) where.push(`p.topic = ${add(topic)}`);
    if (feed === 'following') {
      // Solo lo firmado con nombre: lo anónimo de alguien a quien sigo no
      // debe aparecer como "de alguien a quien sigo" — eso lo firmaría.
      where.push(`not p.is_anonymous and p.status = 'published'
        and exists (select 1 from public.follows f
                     where f.follower_id = auth.uid() and f.followee_id = p.author_id)`);
    }
    if (q) where.push(`${FOLD_SQL('p.body')} like ${add(`%${escapeLike(foldForSearch(q))}%`)}`);

    let order;
    if (sort === 'popular') {
      where.push(`p.status = 'published' and p.created_at > now() - interval '7 days'`);
      order = '(rc.abrazo + rc.fuerza + rc.te_entiendo + rc.inspira + cc.n) desc, p.created_at desc';
    } else {
      if (before) where.push(`p.created_at < ${add(before)}::timestamptz`);
      order = 'p.created_at desc';
    }

    const rows = await withUser(req.userId, async (client) => {
      const result = await client.query(
        `select ${POST_SELECT} from public.posts p ${POST_JOINS}
          where ${where.join(' and ')}
          order by ${order}
          limit ${add(limit)} offset ${add(offset)}`,
        params
      );
      return result.rows;
    });

    const full = rows.length === limit;
    res.json({
      posts: rows.map(mapPost),
      next_before: sort === 'recent' && full ? rows[rows.length - 1]._cursor : null,
      // Con sort=popular el orden no es cronológico: se pagina por offset.
      ...(sort === 'popular' ? { next_offset: full ? offset + limit : null } : {}),
    });
  } catch (error) {
    sendError(res, next, error);
  }
});

// ── publicar y editar ────────────────────────────────────────────────────

function readPostInput(body, { partial }) {
  const text = String(body?.body ?? '').trim();
  if (!text || text.length > BODY_MAX) throw httpError(400, 'texto_invalido');
  const mood = body?.mood;
  if (!validMood(mood)) throw httpError(400, 'mood_invalido');
  const topic = body?.topic ?? (partial ? undefined : 'general');
  if (topic !== undefined && !TOPICS.includes(topic)) throw httpError(400, 'tema_invalido');
  return { text, mood, topic };
}

postsRouter.post('/', async (req, res, next) => {
  try {
    const { text, mood, topic } = readPostInput(req.body, { partial: false });
    const isAnonymous = req.body?.isAnonymous !== false; // por defecto, anónimo

    // status/risk/screened_at no se mandan: sus valores por defecto ('pending',
    // 'unscreened', null) son justo los que exige posts_insert_own_pending.
    const id = await withUser(req.userId, async (client) => {
      await enforceRate(client, 'posts', config.limits.postsPerHour, 'demasiadas_publicaciones');
      const authorName = await resolveAuthorName(client, isAnonymous);
      const { rows } = await client.query(
        `insert into public.posts (author_id, body, mood, topic, is_anonymous, author_display_name)
           values (auth.uid(), $1, $2, $3, $4, $5)
           returning id`,
        [text, mood ?? null, topic, isAnonymous, authorName]
      );
      return rows[0].id;
    });

    const moderation = await applyScreening('posts', id, text);
    const post = await withUser(req.userId, (client) => fetchPost(client, id));
    res.status(201).json({ post, moderation });
  } catch (error) {
    sendError(res, next, error);
  }
});

/**
 * Editar lo propio. authenticated no tiene update sobre posts, así que:
 * 1. withUser comprueba que es suya y que se puede editar;
 * 2. service_role cambia el texto y aplica el filtro en la misma sentencia.
 *
 * Lo rechazado o quitado no se edita (editarlo para que el filtro lo
 * publique sería saltarse la decisión de moderación), y lo ocultado por
 * reportes tampoco (lo mismo con la decisión pendiente).
 */
postsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { text, mood, topic } = readPostInput(req.body, { partial: true });

    await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `select status, held_reason from public.posts where id = $1 and author_id = auth.uid()`,
        [req.params.id]
      );
      if (!rows[0]) throw httpError(404, 'not_found');
      if (['rejected', 'removed'].includes(rows[0].status) || rows[0].held_reason === 'reports') {
        throw httpError(409, 'no_editable');
      }
    });

    const result = screen(text);
    const published = result.outcome === 'published';
    const updated = await withServiceRole(async (client) => {
      const { rowCount } = await client.query(
        `update public.posts
            set body = $2,
                mood = case when $3 then $4::smallint else mood end,
                topic = coalesce($5, topic),
                edited_at = now(),
                status = $6::public.post_status,
                risk = $7::public.risk_level,
                screened_at = now(),
                screening_note = $8,
                held_reason = $9
          where id = $1 and author_id = $10
            and status in ('published', 'pending')
            and held_reason is distinct from 'reports'`,
        [req.params.id, text, mood !== undefined, mood ?? null, topic ?? null,
          published ? 'published' : 'pending', result.risk, result.note,
          published ? null : result.reason, req.userId]
      );
      return rowCount;
    });
    if (!updated) throw httpError(409, 'no_editable');
    if (!published) broadcastQueueChanged();

    const post = await withUser(req.userId, (client) => fetchPost(client, req.params.id));
    res.json({ post, moderation: { outcome: result.outcome, reason: result.reason } });
  } catch (error) {
    sendError(res, next, error);
  }
});

// ── comentarios por id (antes que /:id para que el orden sea evidente) ──

postsRouter.delete('/comments/:id', async (req, res, next) => {
  try {
    await withUser(req.userId, async (client) => {
      await client.query('delete from public.post_comments where id = $1', [req.params.id]);
    });
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

postsRouter.post('/comments/:id/like', async (req, res, next) => {
  try {
    await withUser(req.userId, async (client) => {
      await client.query(
        `insert into public.comment_likes (comment_id, user_id) values ($1, auth.uid())
           on conflict (comment_id, user_id) do nothing`,
        [req.params.id]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

postsRouter.delete('/comments/:id/like', async (req, res, next) => {
  try {
    await withUser(req.userId, async (client) => {
      await client.query(
        'delete from public.comment_likes where comment_id = $1 and user_id = auth.uid()',
        [req.params.id]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

function readReport(body) {
  const reason = body?.reason;
  if (!REPORT_REASONS.includes(reason)) throw httpError(400, 'razon_invalida');
  const detail = body?.detail ? String(body.detail).slice(0, 1000) : null;
  return { reason, detail };
}

postsRouter.post('/comments/:id/report', async (req, res, next) => {
  try {
    const { reason, detail } = readReport(req.body);
    await withUser(req.userId, async (client) => {
      // Solo se reporta lo que se puede ver.
      const visible = await client.query('select 1 from public.post_comments where id = $1', [req.params.id]);
      if (!visible.rows[0]) throw httpError(404, 'not_found');
      await client.query(
        `insert into public.comment_reports (comment_id, reporter_id, reason, detail)
           values ($1, auth.uid(), $2, $3)
           on conflict (comment_id, reporter_id) do nothing`,
        [req.params.id, reason, detail]
      );
    });
    broadcastQueueChanged();
    res.status(201).json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

async function blockAndDescribe(client, fn, id) {
  const { rows } = await client.query(`select public.${fn}($1) as id`, [id]);
  const block = await client.query(
    'select id, created_at, label from public.blocks where id = $1',
    [rows[0].id]
  );
  return block.rows[0];
}

postsRouter.post('/comments/:id/block-author', async (req, res, next) => {
  try {
    const block = await withUser(req.userId, (client) =>
      blockAndDescribe(client, 'block_comment_author', req.params.id));
    res.json({ ok: true, block });
  } catch (error) {
    sendError(res, next, error);
  }
});

// ── una publicación ──────────────────────────────────────────────────────

postsRouter.get('/:id', async (req, res, next) => {
  try {
    const post = await withUser(req.userId, (client) => fetchPost(client, req.params.id));
    if (!post) return res.status(404).json({ error: 'not_found' });
    res.json({ post });
  } catch (error) {
    sendError(res, next, error);
  }
});

postsRouter.delete('/:id', async (req, res, next) => {
  try {
    await withUser(req.userId, async (client) => {
      await client.query('delete from public.posts where id = $1', [req.params.id]);
    });
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

// ── reacciones, guardados, reportes, bloqueos ────────────────────────────

postsRouter.post('/:id/react', async (req, res, next) => {
  try {
    const kind = req.body?.kind ?? 'abrazo';
    if (!REACTION_KINDS.includes(kind)) throw httpError(400, 'reaccion_invalida');

    await withUser(req.userId, async (client) => {
      // Una reacción por persona: volver a reaccionar cambia el tipo. Doble
      // tap con el mismo tipo no falla ni duplica.
      await client.query(
        `insert into public.post_reactions (post_id, user_id, kind) values ($1, auth.uid(), $2)
           on conflict (post_id, user_id) do update set kind = excluded.kind`,
        [req.params.id, kind]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

postsRouter.delete('/:id/react', async (req, res, next) => {
  try {
    await withUser(req.userId, async (client) => {
      await client.query(
        'delete from public.post_reactions where post_id = $1 and user_id = auth.uid()',
        [req.params.id]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

postsRouter.post('/:id/save', async (req, res, next) => {
  try {
    await withUser(req.userId, async (client) => {
      await client.query(
        `insert into public.saved_posts (user_id, post_id) values (auth.uid(), $1)
           on conflict (user_id, post_id) do nothing`,
        [req.params.id]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

postsRouter.delete('/:id/save', async (req, res, next) => {
  try {
    await withUser(req.userId, async (client) => {
      await client.query(
        'delete from public.saved_posts where post_id = $1 and user_id = auth.uid()',
        [req.params.id]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

postsRouter.post('/:id/report', async (req, res, next) => {
  try {
    const { reason, detail } = readReport(req.body);
    await withUser(req.userId, async (client) => {
      // Solo se reporta lo que se puede ver.
      const visible = await client.query('select 1 from public.posts where id = $1', [req.params.id]);
      if (!visible.rows[0]) throw httpError(404, 'not_found');
      // on conflict: reportar dos veces no duplica ni suma al umbral de 3.
      await client.query(
        `insert into public.post_reports (post_id, reporter_id, reason, detail)
           values ($1, auth.uid(), $2, $3)
           on conflict (post_id, reporter_id) do nothing`,
        [req.params.id, reason, detail]
      );
    });
    broadcastQueueChanged();
    res.status(201).json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

postsRouter.post('/:id/block-author', async (req, res, next) => {
  try {
    const block = await withUser(req.userId, (client) =>
      blockAndDescribe(client, 'block_post_author', req.params.id));
    res.json({ ok: true, block });
  } catch (error) {
    sendError(res, next, error);
  }
});

// ── comentarios de una publicación ───────────────────────────────────────
// Mismas reglas que las publicaciones: nace pending, pasa por el filtro,
// elige nombre o anonimato, y comments_insert_own exige que el post ya esté
// publicado — no se comenta en algo que nadie más puede ver todavía.

postsRouter.get('/:id/comments', async (req, res, next) => {
  try {
    const comments = await withUser(req.userId, async (client) => {
      const visible = await client.query(
        `select 1 from public.posts p where p.id = $1 and ${POST_VISIBLE}`,
        [req.params.id]
      );
      if (!visible.rows[0]) throw httpError(404, 'not_found');
      const { rows } = await client.query(
        `select ${COMMENT_SELECT} from public.post_comments c
          where c.post_id = $1 and not public.comment_hidden_for_me(c.id)
          order by c.created_at asc`,
        [req.params.id]
      );
      return rows.map(mapComment);
    });
    res.json({ comments });
  } catch (error) {
    sendError(res, next, error);
  }
});

postsRouter.post('/:id/comments', async (req, res, next) => {
  try {
    const body = String(req.body?.body ?? '').trim();
    const isAnonymous = req.body?.isAnonymous !== false;
    const parentId = req.body?.parentId ?? null;
    if (!body || body.length > COMMENT_MAX) throw httpError(400, 'texto_invalido');
    if (parentId !== null && !isUuid(parentId)) throw httpError(400, 'respuesta_invalida');

    const id = await withUser(req.userId, async (client) => {
      await enforceRate(client, 'post_comments', config.limits.commentsPerHour, 'demasiados_comentarios');
      const authorName = await resolveAuthorName(client, isAnonymous);
      const { rows } = await client.query(
        `insert into public.post_comments (post_id, author_id, body, is_anonymous, author_display_name, parent_id)
           values ($1, auth.uid(), $2, $3, $4, $5)
           returning id`,
        [req.params.id, body, isAnonymous, authorName, parentId]
      );
      return rows[0].id;
    });

    const moderation = await applyScreening('post_comments', id, body);
    const comment = await withUser(req.userId, (client) => fetchComment(client, id));
    res.status(201).json({ comment, moderation });
  } catch (error) {
    sendError(res, next, error);
  }
});
