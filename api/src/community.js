import { withServiceRole } from './db.js';
import { screen } from './moderation.js';
import { broadcastQueueChanged } from './realtime.js';

/**
 * Piezas compartidas por las rutas de la comunidad (posts.js, users.js,
 * me.js): cómo se arma un objeto Post o Comment del contrato v2, cómo se
 * aplica el filtro de moderación y cómo se traducen los errores de la base.
 *
 * Todas las consultas de acá corren DENTRO de un withUser: auth.uid() es
 * quien pregunta y las políticas de la base deciden qué filas existen. Lo que
 * se sabe de otras personas (autor, bloqueos) sale de funciones security
 * definer que nunca devuelven ids internos — ver la migración
 * …_public_functions.
 */

export const TOPICS = ['general', 'estudios', 'ansiedad', 'relaciones', 'logros', 'autocuidado', 'desahogo'];
export const REACTION_KINDS = ['abrazo', 'fuerza', 'te_entiendo', 'inspira'];
export const REPORT_REASONS = ['self_harm', 'harassment', 'spam', 'personal_info', 'other'];

export const BODY_MAX = 2000;
export const COMMENT_MAX = 1000;
export const PAGE_DEFAULT = 20;
export const PAGE_MAX = 50;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

/** Error con status HTTP y código del contrato, para lanzarlo desde adentro de una transacción. */
export function httpError(status, code) {
  const error = new Error(code);
  error.httpStatus = status;
  error.code = code;
  return error;
}

/**
 * Traduce lo que la base rechaza a respuestas del contrato:
 *   42501 (RLS: no es tuyo o no lo puedes ver) y 23503 (no existe) → 404.
 * No hay que distinguir "no existe" de "no lo puedes ver": decir cuál de las
 * dos es ya sería filtrar algo.
 */
export function sendError(res, next, error) {
  if (error.httpStatus) return res.status(error.httpStatus).json({ error: error.code });
  if (error.code === '42501' || error.code === '23503' || error.message === 'not_found') {
    return res.status(404).json({ error: 'not_found' });
  }
  if (error.message === 'accion_invalida') return res.status(400).json({ error: 'accion_invalida' });
  if (error.message === 'respuesta_invalida') return res.status(400).json({ error: 'respuesta_invalida' });
  next(error);
}

/** Rechaza con 404 cualquier :id que no sea un uuid, antes de llegar a la base. */
export function uuidParam(req, res, next, value) {
  if (!isUuid(value)) return res.status(404).json({ error: 'not_found' });
  next();
}

/** Parámetro `limit` del contrato: 1–50, por defecto 20. */
export function parseLimit(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return PAGE_DEFAULT;
  return Math.min(Math.max(n, 1), PAGE_MAX);
}

/** Parámetro `before`: una fecha ISO válida o null. Inválido → error 400. */
export function parseBefore(value) {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value);
  if (s.length > 40 || Number.isNaN(Date.parse(s))) throw httpError(400, 'solicitud_invalida');
  return s;
}

// Cursor con microsegundos: created_at de Postgres tiene más precisión que un
// Date de JS, y paginar con el valor truncado podría saltarse publicaciones
// creadas en el mismo milisegundo.
export const cursorSql = (col) =>
  `to_char(${col} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

// ── Post ─────────────────────────────────────────────────────────────────

/**
 * SELECT del objeto Post. `p` es public.posts. Las columnas que empiezan con
 * guion bajo son internas (conteos para mapear, cursor) y no salen al cliente.
 */
export const POST_SELECT = `
  p.id, p.body, p.mood, p.topic, p.status, p.created_at, p.edited_at,
  public.post_author(p.id) as author,
  (p.author_id = auth.uid()) as is_own,
  case when p.author_id = auth.uid() and p.status = 'pending' then p.held_reason end as held_reason,
  rc.abrazo as _abrazo, rc.fuerza as _fuerza, rc.te_entiendo as _te_entiendo, rc.inspira as _inspira,
  (select r.kind from public.post_reactions r where r.post_id = p.id and r.user_id = auth.uid()) as my_reaction,
  cc.n as comment_count,
  exists (select 1 from public.saved_posts s where s.post_id = p.id and s.user_id = auth.uid()) as saved_by_me,
  ${cursorSql('p.created_at')} as _cursor`;

export const POST_JOINS = `
  cross join lateral (
    select count(*) filter (where r.kind = 'abrazo')::int      as abrazo,
           count(*) filter (where r.kind = 'fuerza')::int      as fuerza,
           count(*) filter (where r.kind = 'te_entiendo')::int as te_entiendo,
           count(*) filter (where r.kind = 'inspira')::int     as inspira
      from public.post_reactions r where r.post_id = p.id
  ) rc
  cross join lateral (
    select count(*)::int as n from public.post_comments c
     where c.post_id = p.id and c.status = 'published'
  ) cc`;

// Lo que puedo ver en la app: lo publicado y lo mío en cualquier estado. La
// política posts_select_moderator deja ver todo a moderación, pero eso es
// para el panel, no para el feed del teléfono.
export const POST_VISIBLE = `(p.status = 'published' or p.author_id = auth.uid())
  and not public.post_hidden_for_me(p.id)`;

export function mapPost(row) {
  const reaction_counts = {
    abrazo: row._abrazo, fuerza: row._fuerza, te_entiendo: row._te_entiendo, inspira: row._inspira,
  };
  return {
    id: row.id,
    body: row.body,
    mood: row.mood,
    topic: row.topic,
    status: row.status,
    created_at: row.created_at,
    edited_at: row.edited_at,
    author: row.author ?? null,
    author_name: row.author?.display_name ?? null,
    is_own: row.is_own,
    reactions: reaction_counts.abrazo + reaction_counts.fuerza + reaction_counts.te_entiendo + reaction_counts.inspira,
    reaction_counts,
    my_reaction: row.my_reaction ?? null,
    reacted_by_me: row.my_reaction != null,
    comment_count: row.comment_count,
    saved_by_me: row.saved_by_me,
    held_reason: row.held_reason ?? null,
  };
}

/** Un post por id, tal como lo ve quien pregunta. null si no lo puede ver. */
export async function fetchPost(client, id) {
  const { rows } = await client.query(
    `select ${POST_SELECT} from public.posts p ${POST_JOINS}
      where p.id = $1 and ${POST_VISIBLE}`,
    [id]
  );
  return rows[0] ? mapPost(rows[0]) : null;
}

/** Página de posts con cursor por created_at (o por el cursor que se indique). */
export function page(rows, limit, cursorKey = '_cursor') {
  const next_before = rows.length === limit ? rows[rows.length - 1][cursorKey] : null;
  return { posts: rows.map(mapPost), next_before };
}

// ── Comment ──────────────────────────────────────────────────────────────

export const COMMENT_SELECT = `
  c.id, c.post_id, c.parent_id, c.body, c.status, c.created_at,
  public.comment_author(c.id) as author,
  (c.author_id = auth.uid()) as is_own,
  (select count(*)::int from public.comment_likes l where l.comment_id = c.id) as likes,
  exists (select 1 from public.comment_likes l where l.comment_id = c.id and l.user_id = auth.uid()) as liked_by_me,
  case when c.author_id = auth.uid() and c.status = 'pending' then c.held_reason end as held_reason`;

export function mapComment(row) {
  return {
    id: row.id,
    post_id: row.post_id,
    parent_id: row.parent_id,
    body: row.body,
    status: row.status,
    created_at: row.created_at,
    author: row.author ?? null,
    author_name: row.author?.display_name ?? null,
    is_own: row.is_own,
    likes: row.likes,
    liked_by_me: row.liked_by_me,
    held_reason: row.held_reason ?? null,
  };
}

export async function fetchComment(client, id) {
  const { rows } = await client.query(
    `select ${COMMENT_SELECT} from public.post_comments c where c.id = $1`,
    [id]
  );
  return rows[0] ? mapComment(rows[0]) : null;
}

// ── filtro de moderación ─────────────────────────────────────────────────

/**
 * Pasa por el filtro algo que ACABA de insertarse como 'pending' (o de
 * editarse) y lo publica o lo deja retenido.
 *
 * Por qué service_role: la política de insert exige 'pending' y
 * authenticated no tiene update sobre posts ni comentarios — quien escribe no
 * puede publicarse a sí mismo. Este es el único camino, y solo corre después
 * de que withUser insertó la fila con la identidad real (la política ya
 * comprobó que es suya). El `status = 'pending'` del where impide que esto
 * reviva algo rechazado o quitado.
 *
 * Si el filtro o esta actualización fallan, la fila queda 'pending' y
 * 'unscreened': no aparece. Falla cerrado.
 */
export async function applyScreening(table, id, text) {
  if (table !== 'posts' && table !== 'post_comments') throw new Error('tabla no moderable');
  const result = screen(text);
  const published = result.outcome === 'published';

  await withServiceRole(async (client) => {
    await client.query(
      `update public.${table}
          set status = $2::public.post_status,
              risk = $3::public.risk_level,
              screened_at = now(),
              screening_note = $4,
              held_reason = $5
        where id = $1 and status = 'pending'`,
      [id, published ? 'published' : 'pending', result.risk, result.note, published ? null : result.reason]
    );
  });

  if (!published) broadcastQueueChanged();
  return { outcome: result.outcome, reason: result.reason };
}

/** Normaliza texto para búsqueda: minúsculas y sin tildes (igual que el SQL). */
export function foldForSearch(text) {
  return String(text ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Lo mismo del lado de Postgres, sin depender de la extensión unaccent.
export const FOLD_SQL = (col) =>
  `translate(lower(${col}), 'áéíóúüñàèìòùäëïöâêîôûç', 'aeiouunaeiouaeioaeiouc')`;
