import { dayKey } from '../lib/dates.js';

/**
 * Retos: catálogo, unirse, registrar el día, abandonar.
 *
 * Lógica pura (sin React Native) para poder probarla en Node. Quien la usa le
 * inyecta `fetchImpl` y un `storage` { read, write, remove } — en la app,
 * fetch global y AsyncStorage (ver wellnessStore.js); en las pruebas, dobles.
 *
 * Dos modos con la MISMA forma de datos (la del contrato v2, api/API.md):
 *   - remoto: el servidor tiene v2 → GET/POST/DELETE /challenges.
 *   - local:  el servidor es v1 (sin /challenges) o no hay API → el progreso
 *             se guarda en el teléfono. Así la pantalla no distingue.
 *
 * El día que cuenta es siempre el día LOCAL del cliente (dayKey), nunca
 * toISOString(): un registro a las 11 p.m. en Bogotá es de ese día, no del
 * siguiente en UTC.
 */

export const CHALLENGES_STORAGE_KEY = 'raiz.challenges.v1';

/**
 * Catálogo para el modo local. Es copia exacta de la semilla de la base
 * (supabase/migrations/20260809000003_seed_challenges.sql): mismas claves,
 * títulos y duración. Si la semilla cambia, cambiar aquí también.
 */
export const LOCAL_CATALOG = [
  { key: 'breathing_7', title_es: '7 días de respiración', title_en: '7 days of breathing', total_days: 7 },
  { key: 'gratitude_7', title_es: '7 días de gratitud', title_en: '7 days of gratitude', total_days: 7 },
  { key: 'sleep_14', title_es: 'Dormir antes de 11pm', title_en: 'Sleep before 11pm', total_days: 14 },
  { key: 'walk_30', title_es: 'Caminar 20 minutos', title_en: 'Walk 20 minutes', total_days: 30 },
];

export class ChallengeError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = 'ChallengeError';
    this.code = code;
    this.status = status;
  }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDayKey = (s) => typeof s === 'string' && DAY_RE.test(s);

/** Normaliza un reto (del servidor o local) a la forma del contrato. */
export function normalizeChallenge(c) {
  const total = Number(c.total_days) || 0;
  const done = Math.max(0, Math.min(total || Infinity, Number(c.completed_days) || 0));
  return {
    key: String(c.key),
    title: c.title ?? String(c.key),
    total_days: total,
    joined: !!c.joined,
    completed_days: done,
    completed_at: c.completed_at ?? null,
    checked_today: !!c.checked_today,
  };
}

// ── almacenamiento local ────────────────────────────────────────────────────

async function readLocal(storage) {
  const raw = await storage.read(CHALLENGES_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.progress && typeof parsed.progress === 'object'
      ? parsed.progress
      : {};
  } catch {
    return {};
  }
}

async function writeLocal(storage, progress) {
  await storage.write(CHALLENGES_STORAGE_KEY, JSON.stringify({ version: 1, progress }));
}

function localView(item, rec, lang, today) {
  const days = Array.isArray(rec?.days) ? rec.days : [];
  return normalizeChallenge({
    key: item.key,
    title: lang === 'en' ? item.title_en : item.title_es,
    total_days: item.total_days,
    joined: !!rec,
    completed_days: days.length,
    completed_at: rec?.completed_at ?? null,
    checked_today: days.includes(today),
  });
}

// ── cliente ─────────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string|null} opts.apiUrl
 * @param {string|null} opts.token
 * @param {1|2|null|undefined} opts.apiVersion  lo que expone AppContext; null = aún no se sabe
 * @param {Function} opts.fetchImpl
 * @param {{read,write,remove}} opts.storage
 * @param {'es'|'en'} opts.lang
 * @param {Array} [opts.catalog]  catálogo local (por defecto LOCAL_CATALOG)
 */
export function createChallengesClient({
  apiUrl, token, apiVersion, fetchImpl, storage, lang = 'es', catalog = LOCAL_CATALOG,
}) {
  // 'remote' | 'local' | null (sin decidir: se prueba el servidor y un 404 decide)
  let mode = null;
  if (!apiUrl || !token || !fetchImpl) mode = 'local';
  else if (apiVersion === 1) mode = 'local';
  else if (apiVersion === 2) mode = 'remote';

  async function call(method, path, body) {
    let res;
    try {
      res = await fetchImpl(`${apiUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ChallengeError('sin_conexion', 0);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ChallengeError(data?.error ?? 'error_desconocido', res.status);
    return data;
  }

  /** Ejecuta en remoto; si aún no se sabe la versión y el servidor da 404, pasa a local. */
  async function withMode(remoteFn, localFn) {
    if (mode === 'local') return localFn();
    try {
      const out = await remoteFn();
      mode = 'remote';
      return out;
    } catch (e) {
      if (mode === null && e instanceof ChallengeError && e.status === 404) {
        mode = 'local';
        return localFn();
      }
      throw e;
    }
  }

  const findItem = (key) => catalog.find(c => c.key === key);

  return {
    /** 'remote' | 'local' | null — null hasta la primera llamada si no se sabía la versión. */
    get mode() { return mode; },

    async list(now = new Date()) {
      const today = dayKey(now);
      return withMode(
        async () => {
          const data = await call('GET', `/challenges?lang=${lang === 'en' ? 'en' : 'es'}`);
          return (data.challenges ?? []).map(normalizeChallenge);
        },
        async () => {
          const progress = await readLocal(storage);
          return catalog.map(item => localView(item, progress[item.key], lang, today));
        },
      );
    },

    async join(key, now = new Date()) {
      return withMode(
        () => call('POST', `/challenges/${encodeURIComponent(key)}/join`),
        async () => {
          if (!findItem(key)) throw new ChallengeError('not_found', 404);
          const progress = await readLocal(storage);
          if (!progress[key]) {
            progress[key] = { joined_at: now.toISOString(), days: [], completed_at: null };
            await writeLocal(storage, progress);
          }
          return { ok: true };
        },
      );
    },

    async leave(key) {
      return withMode(
        () => call('DELETE', `/challenges/${encodeURIComponent(key)}`),
        async () => {
          const progress = await readLocal(storage);
          if (progress[key]) {
            delete progress[key];
            await writeLocal(storage, progress);
          }
          return { ok: true };
        },
      );
    },

    /**
     * Registra el día de hoy (día local). Una vez por día: la segunda vez lanza
     * ChallengeError('ya_registrado_hoy', 409), igual que el servidor.
     */
    async checkIn(key, now = new Date()) {
      const date = dayKey(now);
      return withMode(
        () => call('POST', `/challenges/${encodeURIComponent(key)}/progress`, { date }),
        async () => {
          const item = findItem(key);
          if (!item) throw new ChallengeError('not_found', 404);
          const progress = await readLocal(storage);
          const rec = progress[key];
          if (!rec) throw new ChallengeError('no_unido', 409);
          if (rec.completed_at) throw new ChallengeError('ya_completado', 409);
          const days = Array.isArray(rec.days) ? rec.days : [];
          if (days.includes(date)) throw new ChallengeError('ya_registrado_hoy', 409);
          const nextDays = [...days, date];
          progress[key] = {
            ...rec,
            days: nextDays,
            completed_at: nextDays.length >= item.total_days ? now.toISOString() : null,
          };
          await writeLocal(storage, progress);
          return { ok: true };
        },
      );
    },
  };
}

/** Retos a los que la persona está unida y no ha terminado. */
export const activeChallenges = (list) => list.filter(c => c.joined && !c.completed_at);
/** Retos terminados. */
export const completedChallenges = (list) => list.filter(c => c.joined && c.completed_at);
/** Retos del catálogo a los que no está unida. */
export const availableChallenges = (list) => list.filter(c => !c.joined);
