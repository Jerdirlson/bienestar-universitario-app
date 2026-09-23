import { Router } from 'express';
import { withUser } from './db.js';
import { requireSession } from './auth.js';
import { httpError, sendError, isUuid } from './community.js';

/**
 * El diario: check-in diario (/entries) y diario libre (/journal).
 *
 * La regla que no se negocia (CLAUDE.md): es privado. Todo pasa por withUser
 * y las políticas de `entries` y `journal_entries` solo dejan ver y escribir
 * las filas propias — ni moderación ni administración tienen política, y aquí
 * no hay ningún withServiceRole. El contenido NUNCA pasa por el filtro de
 * moderación: el servidor no analiza lo que alguien escribe para sí.
 *
 * Las validaciones reflejan las restricciones de las tablas: si el cliente
 * manda algo que Postgres rechazaría, se responde `entrada_invalida` antes de
 * llegar a la base.
 */

const invalid = () => httpError(400, 'entrada_invalida');

// Fecha de calendario real: '2026-02-30' tiene la forma pero no existe.
function isCalendarDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const isMood = (m) => Number.isInteger(m) && m >= 0 && m <= 4;

// Claves estables (feelings/causes), no etiquetas: texto corto, sin límite de
// forma más allá de eso para no desincronizarse de i18n.js.
function isKeyList(list) {
  return Array.isArray(list) && list.length <= 30
    && list.every((k) => typeof k === 'string' && k.length >= 1 && k.length <= 40);
}

// ── check-in diario ──────────────────────────────────────────────────────

// entry_date sale como texto: un `date` de Postgres llega a Node como Date a
// medianoche LOCAL y al serializarlo puede correrse un día.
const ENTRY_SELECT = `to_char(entry_date, 'YYYY-MM-DD') as entry_date, mood, feelings, causes, note, created_at, updated_at`;

export const entriesRouter = Router();
entriesRouter.use(requireSession);
entriesRouter.param('date', (req, res, next, value) => {
  if (!isCalendarDate(value)) return res.status(400).json({ error: 'entrada_invalida' });
  next();
});

entriesRouter.get('/', async (req, res, next) => {
  try {
    const entries = await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `select ${ENTRY_SELECT} from public.entries
          where user_id = auth.uid()
          order by entry_date desc`
      );
      return rows;
    });
    res.json({ entries });
  } catch (error) {
    sendError(res, next, error);
  }
});

entriesRouter.put('/:date', async (req, res, next) => {
  try {
    const { mood, feelings = [], causes = [], note = null } = req.body ?? {};
    if (!isMood(mood) || !isKeyList(feelings) || !isKeyList(causes)) throw invalid();
    if (note !== null && (typeof note !== 'string' || note.length > 4000)) throw invalid();

    const entry = await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `insert into public.entries (user_id, entry_date, mood, feelings, causes, note)
           values (auth.uid(), $1, $2, $3, $4, $5)
           on conflict (user_id, entry_date) do update
             set mood = excluded.mood, feelings = excluded.feelings,
                 causes = excluded.causes, note = excluded.note
           returning ${ENTRY_SELECT}`,
        [req.params.date, mood, feelings, causes, note]
      );
      return rows[0];
    });
    res.json({ entry });
  } catch (error) {
    sendError(res, next, error);
  }
});

// Idempotente: borrar lo que no existe (o ya se borró) responde igual.
entriesRouter.delete('/:date', async (req, res, next) => {
  try {
    await withUser(req.userId, (client) =>
      client.query('delete from public.entries where user_id = auth.uid() and entry_date = $1', [req.params.date]));
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

// ── diario libre ─────────────────────────────────────────────────────────

const JOURNAL_SELECT = 'id, title, body, prompt_key, mood, created_at, updated_at';

export const journalRouter = Router();
journalRouter.use(requireSession);
journalRouter.param('id', (req, res, next, value) => {
  if (!isUuid(value)) return res.status(400).json({ error: 'entrada_invalida' });
  next();
});

journalRouter.get('/', async (req, res, next) => {
  try {
    const entries = await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `select ${JOURNAL_SELECT} from public.journal_entries
          where user_id = auth.uid()
          order by created_at desc`
      );
      return rows;
    });
    res.json({ entries });
  } catch (error) {
    sendError(res, next, error);
  }
});

/**
 * Upsert por id (lo genera el cliente para poder crear sin conexión).
 * createdAt solo cuenta al crear: editar no cambia cuándo se escribió.
 * Si el id ya es de OTRA persona, la política de update rechaza el
 * on conflict y se responde 404 — sin decir que el id existe.
 */
journalRouter.put('/:id', async (req, res, next) => {
  try {
    const { title = null, body, promptKey = null, mood = null, createdAt = null } = req.body ?? {};
    if (typeof body !== 'string' || body.trim().length < 1 || body.length > 10000) throw invalid();
    if (title !== null && (typeof title !== 'string' || title.length > 120)) throw invalid();
    if (promptKey !== null && (typeof promptKey !== 'string' || promptKey.length > 40)) throw invalid();
    if (mood !== null && !isMood(mood)) throw invalid();
    if (createdAt !== null) {
      const t = Date.parse(createdAt);
      // Hasta un día en el futuro por relojes desfasados; más que eso es un error.
      if (typeof createdAt !== 'string' || Number.isNaN(t) || t > Date.now() + 86_400_000) throw invalid();
    }

    const entry = await withUser(req.userId, async (client) => {
      const { rows } = await client.query(
        `insert into public.journal_entries (id, user_id, title, body, prompt_key, mood, created_at)
           values ($1, auth.uid(), $2, $3, $4, $5, coalesce($6::timestamptz, now()))
           on conflict (id) do update
             set title = excluded.title, body = excluded.body,
                 prompt_key = excluded.prompt_key, mood = excluded.mood
           returning ${JOURNAL_SELECT}`,
        [req.params.id, title || null, body, promptKey || null, mood, createdAt]
      );
      return rows[0];
    });
    res.json({ entry });
  } catch (error) {
    sendError(res, next, error);
  }
});

journalRouter.delete('/:id', async (req, res, next) => {
  try {
    await withUser(req.userId, (client) =>
      client.query('delete from public.journal_entries where user_id = auth.uid() and id = $1', [req.params.id]));
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});
