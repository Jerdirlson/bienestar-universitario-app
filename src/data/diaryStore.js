import { normalizeEntry } from './entry.js';
import { normalizeJournal } from './journal.js';
import { STORAGE_KEY as LEGACY_ENTRIES_KEY } from './entriesRepository.js';

/**
 * Diario local-first: check-ins (`entries`, uno por día) y diario libre
 * (`journal`, varios por día), con una cola de cambios pendientes de subir.
 *
 * Puro: no importa nada de React Native. `storage` es la misma interfaz mínima
 * que usa entriesRepository — read/write/remove sobre una clave, y
 * opcionalmente writeMany para escribir varias claves de una vez — así que en
 * pruebas corre contra memoria y en la app contra AsyncStorage (store.js).
 *
 * Todo se guarda al instante en el teléfono; la sincronización (diarySync.js)
 * sube después lo que haya en la cola. Cada persona tiene su propio espacio
 * (`namespace` = id de usuario, o 'guest' sin sesión): en un teléfono
 * compartido nadie ve el diario de otra cuenta.
 *
 * Cola: como mucho una operación por registro — { col, key, kind, at, base }.
 *   kind  'put' | 'delete'
 *   at    cuándo se hizo el cambio en el teléfono (para "la última escritura gana")
 *   base  updated_at del servidor sobre el que se hizo el cambio, o null si el
 *         teléfono nunca vio ese registro en el servidor. Si al bajar datos el
 *         servidor sigue en `base`, nadie más lo tocó y el cambio local gana
 *         sin comparar relojes (que entre teléfono y servidor pueden diferir).
 */

export const DIARY_PREFIX = 'raiz.diary.v2';
export const GUEST_NAMESPACE = 'guest';

export const storageKeysFor = (ns) => ({
  entries: `${DIARY_PREFIX}.${ns}.entries`,
  journal: `${DIARY_PREFIX}.${ns}.journal`,
  queue: `${DIARY_PREFIX}.${ns}.queue`,
  drafts: `${DIARY_PREFIX}.${ns}.drafts`,
  meta: `${DIARY_PREFIX}.${ns}.meta`,
});

const COLLECTIONS = {
  entries: { keyOf: (r) => r.entryDate },
  journal: { keyOf: (r) => r.id },
};

export const ts = (iso) => {
  const n = Date.parse(iso ?? '');
  return Number.isNaN(n) ? 0 : n;
};
const sameTs = (a, b) => a != null && b != null && ts(a) === ts(b);

const parseJson = (raw, fallback) => {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(fallback)) return Array.isArray(v) ? v : fallback;
    return v && typeof v === 'object' && !Array.isArray(v) ? v : fallback;
  } catch {
    // Guardado corrupto: mejor empezar limpio que dejar la app en blanco.
    return fallback;
  }
};

// `_srv` (updated_at del servidor visto por última vez) es interno.
const publicRecord = (r) => {
  if (!r) return null;
  const { _srv, ...rest } = r;
  return rest;
};

const byEntryDateDesc = (a, b) => (a.entryDate < b.entryDate ? 1 : a.entryDate > b.entryDate ? -1 : 0);
const byCreatedDesc = (a, b) => ts(b.createdAt) - ts(a.createdAt);

export function createDiaryStore(storage, namespace = GUEST_NAMESPACE, options = {}) {
  const { now = () => new Date(), newId } = options;
  const keys = storageKeysFor(namespace);

  const state = {
    entries: new Map(),
    journal: new Map(),
    queue: [],
    drafts: {},
    meta: {},
  };
  let loaded = false;
  // Identifica cada versión de una operación: dos guardados en el mismo
  // milisegundo siguen siendo distintos.
  let seq = 0;
  const listeners = new Set();

  // Toda mutación pasa por aquí, una detrás de otra: un guardado y el resultado
  // de una subida que llega al mismo tiempo no se pisan.
  let chain = Promise.resolve();
  const exclusive = (fn) => {
    const run = chain.then(fn);
    chain = run.catch(() => {});
    return run;
  };

  const serialize = {
    entries: () => JSON.stringify([...state.entries.values()]),
    journal: () => JSON.stringify([...state.journal.values()]),
    queue: () => JSON.stringify(state.queue),
    drafts: () => JSON.stringify(state.drafts),
    meta: () => JSON.stringify(state.meta),
  };

  // La cola se escribe primero: si la app muere a mitad de camino, un registro
  // sin su operación pendiente se tomaría por "borrado en el servidor" en la
  // próxima sincronización. Una operación sin registro, en cambio, se descarta
  // sin daño.
  const ORDER = ['queue', 'entries', 'journal', 'drafts', 'meta'];
  const persist = async (...parts) => {
    const pairs = ORDER.filter((p) => parts.includes(p)).map((p) => [keys[p], serialize[p]()]);
    if (typeof storage.writeMany === 'function') {
      await storage.writeMany(pairs);
    } else {
      for (const [k, v] of pairs) await storage.write(k, v);
    }
  };

  const pendingOps = () => state.queue.filter((o) => !o.rejected);

  const snapshot = () => ({
    entries: [...state.entries.values()].map(publicRecord).sort(byEntryDateDesc),
    journal: [...state.journal.values()].map(publicRecord).sort(byCreatedDesc),
    pending: pendingOps().length,
    rejected: state.queue.length - pendingOps().length,
    lastPullAt: state.meta.lastPullAt ?? null,
  });

  let cachedSnapshot = null;
  const emit = () => {
    cachedSnapshot = null;
    const snap = api.getSnapshot();
    for (const l of listeners) {
      try { l(snap); } catch { /* un oyente roto no detiene a los demás */ }
    }
  };

  const findOp = (col, key) => state.queue.find((o) => o.col === col && o.key === key) ?? null;

  const enqueue = (col, key, kind, at, base) => {
    const existing = findOp(col, key);
    // Se conserva la base original: el cambio sigue partiendo de la versión
    // del servidor que el teléfono vio antes de la primera edición pendiente.
    seq += 1;
    const op = { col, key, kind, at, seq, base: existing ? existing.base : (base ?? null) };
    state.queue = [...state.queue.filter((o) => o !== existing), op];
    return op;
  };

  /**
   * Incorpora registros que nunca se subieron a esta cuenta (histórico de
   * antes de la sincronización, o lo escrito sin sesión). Cada uno queda
   * pendiente de subir; si ya existe uno local con la misma clave, gana el
   * más reciente.
   */
  const importRecords = (col, records) => {
    const { keyOf } = COLLECTIONS[col];
    let imported = 0;
    for (const raw of records) {
      let rec;
      try {
        const stamp = ts(raw?.updatedAt ?? raw?.createdAt);
        const when = stamp ? new Date(stamp) : now();
        rec = col === 'entries'
          ? normalizeEntry(raw, when)
          : normalizeJournal(raw, when, newId);
      } catch {
        continue; // un registro inválido no bloquea la importación del resto
      }
      rec = {
        ...rec,
        createdAt: ts(raw.createdAt) ? raw.createdAt : rec.createdAt,
        updatedAt: ts(raw.updatedAt) ? raw.updatedAt : rec.updatedAt,
      };
      const k = keyOf(rec);
      const local = state[col].get(k);
      if (local && ts(local.updatedAt) >= ts(rec.updatedAt)) continue;
      state[col].set(k, { ...rec, _srv: local?._srv });
      enqueue(col, k, 'put', rec.updatedAt, local?._srv ?? null);
      imported += 1;
    }
    return imported;
  };

  const api = {
    namespace,

    get loaded() { return loaded; },

    /** Lee el disco. Migra el histórico de la versión anterior (una sola vez). */
    load: () => exclusive(async () => {
      if (loaded) return api.getSnapshot();
      const [entriesRaw, journalRaw, queueRaw, draftsRaw, metaRaw] = await Promise.all(
        ['entries', 'journal', 'queue', 'drafts', 'meta'].map((p) => storage.read(keys[p]))
      );
      for (const r of parseJson(entriesRaw, [])) if (r?.entryDate) state.entries.set(r.entryDate, r);
      for (const r of parseJson(journalRaw, [])) if (r?.id) state.journal.set(r.id, r);
      state.queue = parseJson(queueRaw, []).filter((o) => o && COLLECTIONS[o.col] && o.key);
      seq = state.queue.reduce((m, o) => Math.max(m, Number(o.seq) || 0), 0);
      for (const o of state.queue) if (!o.seq) { seq += 1; o.seq = seq; }
      state.drafts = parseJson(draftsRaw, {});
      state.meta = parseJson(metaRaw, {});

      // Check-ins guardados antes de que existiera la sincronización
      // (raiz.entries.v1): no tienen dueño, así que pasan SOLO al espacio
      // sin sesión. De ahí la app pregunta antes de llevarlos a una cuenta
      // (offerAdoption en AppContext); si se cargaran en el espacio de la
      // primera cuenta que abre, se subirían a ella sin preguntar.
      const legacyRaw = namespace === GUEST_NAMESPACE ? await storage.read(LEGACY_ENTRIES_KEY) : null;
      if (legacyRaw) {
        const legacy = parseJson(legacyRaw, []);
        if (importRecords('entries', legacy) > 0) await persist('queue', 'entries');
        await storage.remove(LEGACY_ENTRIES_KEY);
      }
      loaded = true;
      emit();
      return api.getSnapshot();
    }),

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      if (!cachedSnapshot) cachedSnapshot = snapshot();
      return cachedSnapshot;
    },

    pendingCount: () => pendingOps().length,
    pendingOps: () => pendingOps().map((o) => ({ ...o })),
    getRecord: (col, key) => publicRecord(state[col].get(key)),

    // ── check-in ─────────────────────────────────────────────────────────────

    /** Un registro por día: si ya existe lo reemplaza, conservando createdAt. */
    saveEntry: (input) => exclusive(async () => {
      const draft = normalizeEntry(input, now());
      const prev = state.entries.get(draft.entryDate);
      const entry = { ...draft, createdAt: prev?.createdAt ?? draft.createdAt, _srv: prev?._srv };
      state.entries.set(entry.entryDate, entry);
      enqueue('entries', entry.entryDate, 'put', entry.updatedAt, prev?._srv ?? null);
      await persist('queue', 'entries');
      emit();
      return publicRecord(entry);
    }),

    deleteEntry: (entryDate) => exclusive(async () => {
      const prev = state.entries.get(entryDate);
      if (!prev && !findOp('entries', entryDate)) return false;
      state.entries.delete(entryDate);
      enqueue('entries', entryDate, 'delete', now().toISOString(), prev?._srv ?? null);
      await persist('queue', 'entries');
      emit();
      return true;
    }),

    // ── diario libre ─────────────────────────────────────────────────────────

    saveJournal: (input) => exclusive(async () => {
      const prev = input?.id ? state.journal.get(String(input.id).toLowerCase()) : null;
      const draft = normalizeJournal({ ...input, createdAt: prev?.createdAt ?? input?.createdAt }, now(), newId);
      const entry = { ...draft, _srv: prev?._srv };
      state.journal.set(entry.id, entry);
      enqueue('journal', entry.id, 'put', entry.updatedAt, prev?._srv ?? null);
      await persist('queue', 'journal');
      emit();
      return publicRecord(entry);
    }),

    deleteJournal: (id) => exclusive(async () => {
      const key = String(id).toLowerCase();
      const prev = state.journal.get(key);
      if (!prev && !findOp('journal', key)) return false;
      state.journal.delete(key);
      enqueue('journal', key, 'delete', now().toISOString(), prev?._srv ?? null);
      await persist('queue', 'journal');
      emit();
      return true;
    }),

    // ── borradores del editor (solo locales, nunca se suben) ─────────────────

    getDraft: (draftKey) => state.drafts[draftKey] ?? null,

    setDraft: (draftKey, value) => exclusive(async () => {
      if (value == null) delete state.drafts[draftKey];
      else state.drafts[draftKey] = { ...value, savedAt: now().toISOString() };
      await persist('drafts');
    }),

    // ── lo que usa la sincronización ─────────────────────────────────────────

    /**
     * Fusiona la lista completa que devolvió el servidor para una colección.
     * `serverRecords` ya viene en la forma local (camelCase, ver diaryApi.js).
     *
     *  - Sin cambio local pendiente: manda el servidor. Lo que el servidor ya
     *    no tiene se borró desde otro lado y se borra aquí también.
     *  - Con cambio pendiente: si el servidor sigue en la versión sobre la que
     *    se editó, gana lo local. Si alguien más lo cambió, gana la última
     *    escritura por updated_at. Un cambio local nunca se pierde por una
     *    lista que simplemente no lo tiene todavía.
     */
    applyServerSnapshot: (col, serverRecords) => exclusive(async () => {
      const { keyOf } = COLLECTIONS[col];
      const ops = new Map(state.queue.filter((o) => o.col === col).map((o) => [o.key, o]));
      const dropped = new Set();
      const next = new Map();

      for (const s of serverRecords) {
        const k = keyOf(s);
        if (!k) continue;
        const op = ops.get(k);
        if (!op) {
          next.set(k, { ...s, _srv: s.updatedAt });
          continue;
        }
        const remoteUnchanged = sameTs(op.base, s.updatedAt);
        const serverWins = !remoteUnchanged && ts(s.updatedAt) > ts(op.at);
        if (serverWins) {
          next.set(k, { ...s, _srv: s.updatedAt });
          dropped.add(op);
        } else {
          // Gana lo local; queda basado en lo que el servidor tiene ahora.
          op.base = s.updatedAt;
          if (op.kind === 'put') {
            const local = state[col].get(k);
            if (local) next.set(k, { ...local, _srv: s.updatedAt });
          }
        }
      }

      for (const [k, local] of state[col]) {
        if (next.has(k)) continue;
        const op = ops.get(k);
        if (op && op.kind === 'put' && !dropped.has(op)) next.set(k, local);
      }

      state[col] = next;
      state.queue = state.queue.filter((o) => !dropped.has(o));
      state.meta = { ...state.meta, lastPullAt: now().toISOString() };
      await persist('queue', col, 'meta');
      emit();
      return { dropped: dropped.size };
    }),

    /**
     * La subida de `op` terminó bien. Si nadie tocó el registro mientras tanto,
     * la operación sale de la cola y el registro adopta lo que respondió el
     * servidor. Si hubo otro cambio local, ese sigue pendiente, ahora basado en
     * la versión que el servidor acaba de confirmar.
     */
    markPushed: (op, serverRecord = null) => exclusive(async () => {
      const current = findOp(op.col, op.key);
      if (current && current.seq === op.seq) {
        state.queue = state.queue.filter((o) => o !== current);
        if (op.kind === 'put' && serverRecord) {
          const local = state[op.col].get(op.key);
          if (local) state[op.col].set(op.key, { ...local, ...serverRecord, _srv: serverRecord.updatedAt });
        }
        await persist('queue', op.col);
      } else if (current) {
        current.base = op.kind === 'put' ? (serverRecord?.updatedAt ?? current.base) : null;
        await persist('queue');
      }
      emit();
    }),

    /** El servidor rechazó la operación por inválida: no se reintenta, pero el dato local se conserva. */
    markRejected: (op, code) => exclusive(async () => {
      const current = findOp(op.col, op.key);
      if (current && current.seq === op.seq) {
        current.rejected = code || 'rechazada';
        await persist('queue');
        emit();
      }
    }),

    /** Una operación sin registro que subir (no debería pasar): se descarta. */
    dropOp: (op) => exclusive(async () => {
      const current = findOp(op.col, op.key);
      if (current && current.seq === op.seq) {
        state.queue = state.queue.filter((o) => o !== current);
        await persist('queue');
        emit();
      }
    }),

    /** Todo lo guardado, para pasarlo a otra cuenta (ver adoptFrom). */
    exportAll: () => ({
      entries: [...state.entries.values()].map(publicRecord),
      journal: [...state.journal.values()].map(publicRecord),
    }),

    /**
     * Trae lo escrito en otro espacio del teléfono (sin sesión) a esta cuenta,
     * marcado para subir, y vacía el otro espacio.
     */
    adoptFrom: async (other) => {
      if (!other || other === api) return 0;
      await other.load();
      const data = other.exportAll();
      const n = await exclusive(async () => {
        const count = importRecords('entries', data.entries) + importRecords('journal', data.journal);
        if (count > 0) {
          await persist('queue', 'entries', 'journal');
          emit();
        }
        return count;
      });
      await other.wipe({ keepPending: false });
      return n;
    },

    /**
     * Borra el diario de este teléfono. Con keepPending, lo que todavía no se
     * pudo subir se conserva (y nada más), para no perder lo escrito sin
     * conexión; se subirá la próxima vez que esa persona inicie sesión.
     * Devuelve cuántos cambios quedaron sin subir.
     */
    wipe: ({ keepPending = true } = {}) => exclusive(async () => {
      state.drafts = {};
      if (keepPending && state.queue.length > 0) {
        for (const col of Object.keys(COLLECTIONS)) {
          const keep = new Set(state.queue.filter((o) => o.col === col).map((o) => o.key));
          state[col] = new Map([...state[col]].filter(([k]) => keep.has(k)));
        }
        state.meta = {};
        await persist('queue', 'entries', 'journal', 'drafts', 'meta');
        emit();
        return state.queue.length;
      }
      state.entries = new Map();
      state.journal = new Map();
      state.queue = [];
      state.meta = {};
      for (const k of Object.values(keys)) await storage.remove(k);
      emit();
      return 0;
    }),
  };

  return api;
}
