import { Router } from 'express';
import { withUser } from './db.js';
import { requireSession } from './auth.js';
import { httpError, sendError } from './community.js';

/**
 * Retos: catálogo (public.challenges, de solo lectura) y el progreso de cada
 * persona (user_challenges, política "solo lo propio").
 *
 * "Hoy" es el día LOCAL de quien usa la app: el cliente lo manda como
 * ?date= / { date }. Sin él se usa el día en America/Bogota, que es donde
 * vive casi toda la comunidad. Para que nadie llene un reto de 30 días en una
 * tarde mandando fechas inventadas, la fecha del cliente solo se acepta si
 * está a un día o menos del día de Bogotá (cubre cualquier zona horaria).
 */

export const challengesRouter = Router();
challengesRouter.use(requireSession);

const BOGOTA_TODAY = `(now() at time zone 'America/Bogota')::date`;

// Fecha de calendario real: '2026-02-30' tiene la forma pero no existe.
function isCalendarDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * El día a usar. Sin fecha (o con una que no es fecha) → hoy en Bogotá.
 * Con `strict` (registrar progreso) la fecha del cliente además tiene que
 * estar a un día o menos de hoy en Bogotá; si no, 400 fecha_invalida. Para
 * leer (checked_today) cualquier fecha real sirve: solo cambia lo que se
 * muestra.
 */
async function resolveDay(client, date, { strict }) {
  if (date !== undefined && date !== null && date !== '' && !isCalendarDate(date)) {
    if (strict) throw httpError(400, 'fecha_invalida');
    date = null;
  }
  const { rows } = await client.query(
    `select to_char(coalesce($1::date, ${BOGOTA_TODAY}), 'YYYY-MM-DD') as d,
            ($1::date is null or $1::date between ${BOGOTA_TODAY} - 1 and ${BOGOTA_TODAY} + 1) as near`,
    [date || null]
  );
  if (strict && !rows[0].near) throw httpError(400, 'fecha_invalida');
  return rows[0].d;
}

const CHALLENGE_SELECT = `
  c.key,
  case when $1 = 'en' then c.title_en else c.title_es end as title,
  c.total_days,
  (uc.id is not null) as joined,
  coalesce(uc.completed_days, 0)::int as completed_days,
  uc.completed_at,
  coalesce(uc.last_progress_date = $2::date, false) as checked_today`;

const CHALLENGE_FROM = `
  from public.challenges c
  left join public.user_challenges uc on uc.challenge_id = c.id and uc.user_id = auth.uid()`;

async function fetchChallenge(client, key, lang, day) {
  const { rows } = await client.query(
    `select ${CHALLENGE_SELECT} ${CHALLENGE_FROM} where c.key = $3 and c.is_active`,
    [lang, day, key]
  );
  return rows[0] ?? null;
}

const langOf = (req) => ((req.query.lang ?? req.body?.lang) === 'en' ? 'en' : 'es');

async function challengeIdOrThrow(client, key) {
  const { rows } = await client.query('select id from public.challenges where key = $1 and is_active', [key]);
  if (!rows[0]) throw httpError(404, 'not_found');
  return rows[0].id;
}

challengesRouter.get('/', async (req, res, next) => {
  try {
    const challenges = await withUser(req.userId, async (client) => {
      const day = await resolveDay(client, req.query.date, { strict: false });
      const { rows } = await client.query(
        `select ${CHALLENGE_SELECT} ${CHALLENGE_FROM}
          where c.is_active
          order by c.total_days, c.key`,
        [langOf(req), day]
      );
      return rows;
    });
    res.json({ challenges });
  } catch (error) {
    sendError(res, next, error);
  }
});

challengesRouter.post('/:key/join', async (req, res, next) => {
  try {
    const challenge = await withUser(req.userId, async (client) => {
      const id = await challengeIdOrThrow(client, req.params.key);
      await client.query(
        `insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), $1)
           on conflict (user_id, challenge_id) do nothing`,
        [id]
      );
      const day = await resolveDay(client, req.body?.date ?? req.query.date, { strict: false });
      return fetchChallenge(client, req.params.key, langOf(req), day);
    });
    res.json({ ok: true, challenge });
  } catch (error) {
    sendError(res, next, error);
  }
});

// Abandonar: borra el progreso. Idempotente.
challengesRouter.delete('/:key', async (req, res, next) => {
  try {
    await withUser(req.userId, async (client) => {
      const id = await challengeIdOrThrow(client, req.params.key);
      await client.query(
        'delete from public.user_challenges where user_id = auth.uid() and challenge_id = $1',
        [id]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    sendError(res, next, error);
  }
});

/**
 * Suma un día. Si todavía no se había unido al reto, lo une (registrar
 * progreso de algo que se está haciendo no debería fallar por un paso previo).
 * Dos veces el mismo día → 409 ya_registrado_hoy. Un reto ya completado no
 * suma más: responde el estado sin cambios.
 */
challengesRouter.post('/:key/progress', async (req, res, next) => {
  try {
    const challenge = await withUser(req.userId, async (client) => {
      const id = await challengeIdOrThrow(client, req.params.key);
      const day = await resolveDay(client, req.body?.date ?? req.query.date, { strict: true });

      await client.query(
        `insert into public.user_challenges (user_id, challenge_id) values (auth.uid(), $1)
           on conflict (user_id, challenge_id) do nothing`,
        [id]
      );
      const { rows } = await client.query(
        `select uc.id, uc.completed_days, uc.completed_at,
                (uc.last_progress_date is not null and uc.last_progress_date >= $2::date) as already,
                c.total_days
           from public.user_challenges uc join public.challenges c on c.id = uc.challenge_id
          where uc.user_id = auth.uid() and uc.challenge_id = $1
          for update of uc`,
        [id, day]
      );
      const uc = rows[0];
      if (uc.already) throw httpError(409, 'ya_registrado_hoy');

      if (!uc.completed_at) {
        await client.query(
          `update public.user_challenges
              set completed_days = least(completed_days + 1, $2),
                  last_progress_date = $3::date,
                  completed_at = case when completed_days + 1 >= $2 then now() else null end
            where id = $1`,
          [uc.id, uc.total_days, day]
        );
      }
      return fetchChallenge(client, req.params.key, langOf(req), day);
    });
    res.json({ ok: true, challenge });
  } catch (error) {
    sendError(res, next, error);
  }
});
