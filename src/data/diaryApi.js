/**
 * Cliente HTTP del diario (api/API.md: "Descubrimiento" y "Diario").
 *
 * Puro: `fetch` y la URL base se inyectan, así las pruebas corren en Node con
 * un fetch simulado. Traduce entre la forma del servidor (snake_case) y la
 * forma local (camelCase, la de entry.js y journal.js).
 *
 * Nada de lo que pasa por aquí se analiza: el texto del diario solo viaja a la
 * cuenta de su dueño.
 */

export class DiaryApiError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'DiaryApiError';
    this.code = code;
    this.status = status;
  }
}

const isoOr = (v, fallback = null) => {
  if (v == null) return fallback;
  const n = Date.parse(v);
  return Number.isNaN(n) ? fallback : new Date(n).toISOString();
};

export function fromServerEntry(s) {
  return {
    entryDate: String(s.entry_date ?? s.entryDate ?? '').slice(0, 10),
    mood: s.mood,
    feelings: Array.isArray(s.feelings) ? s.feelings : [],
    causes: Array.isArray(s.causes) ? s.causes : [],
    note: s.note ?? '',
    createdAt: isoOr(s.created_at ?? s.createdAt),
    updatedAt: isoOr(s.updated_at ?? s.updatedAt),
  };
}

export function fromServerJournal(s) {
  return {
    id: String(s.id).toLowerCase(),
    title: s.title ?? '',
    body: s.body ?? '',
    promptKey: s.prompt_key ?? s.promptKey ?? null,
    mood: s.mood ?? null,
    createdAt: isoOr(s.created_at ?? s.createdAt),
    updatedAt: isoOr(s.updated_at ?? s.updatedAt),
  };
}

export function createDiaryApi({ baseUrl, fetch: fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  const request = async (method, path, { token, body } = {}) => {
    if (!baseUrl) throw new DiaryApiError('sin_configurar', 0);

    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let res;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller?.signal,
      });
    } catch {
      throw new DiaryApiError('sin_conexion', 0);
    } finally {
      if (timer) clearTimeout(timer);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new DiaryApiError(data?.error ?? `http_${res.status}`, res.status);
    return data ?? {};
  };

  const enc = encodeURIComponent;

  return {
    configured: Boolean(baseUrl),

    /**
     * 2 si el servidor tiene el contrato v2. Un servidor v1 no conoce /meta
     * (404, o 401 si todo lo que no conoce pide sesión): eso es 1, no un error.
     * Sin conexión lanza, porque "no sé" no es lo mismo que "v1".
     */
    async getApiVersion() {
      try {
        const data = await request('GET', '/meta');
        const v = Number(data.api_version);
        return Number.isFinite(v) && v >= 1 ? v : 1;
      } catch (e) {
        if (e instanceof DiaryApiError && [401, 403, 404, 405].includes(e.status)) return 1;
        throw e;
      }
    },

    async listEntries(token) {
      const data = await request('GET', '/entries', { token });
      return (data.entries ?? []).map(fromServerEntry);
    },

    async putEntry(token, entry) {
      const data = await request('PUT', `/entries/${enc(entry.entryDate)}`, {
        token,
        body: { mood: entry.mood, feelings: entry.feelings, causes: entry.causes, note: entry.note ?? '' },
      });
      return data.entry ? fromServerEntry(data.entry) : null;
    },

    async deleteEntry(token, entryDate) {
      try {
        await request('DELETE', `/entries/${enc(entryDate)}`, { token });
      } catch (e) {
        if (e.status !== 404) throw e; // ya no estaba: borrar es idempotente
      }
    },

    async listJournal(token) {
      const data = await request('GET', '/journal', { token });
      return (data.entries ?? []).map(fromServerJournal);
    },

    async putJournal(token, j) {
      const data = await request('PUT', `/journal/${enc(j.id)}`, {
        token,
        body: {
          title: j.title ?? '',
          body: j.body,
          promptKey: j.promptKey ?? null,
          mood: j.mood ?? null,
          createdAt: j.createdAt,
        },
      });
      return data.entry ? fromServerJournal(data.entry) : null;
    },

    async deleteJournal(token, id) {
      try {
        await request('DELETE', `/journal/${enc(id)}`, { token });
      } catch (e) {
        if (e.status !== 404) throw e;
      }
    },
  };
}
