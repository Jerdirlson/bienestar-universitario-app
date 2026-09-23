/**
 * Sincronización del diario: baja lo del servidor, lo fusiona con el teléfono
 * y sube la cola de cambios pendientes (diaryStore.js).
 *
 * Puro: el cliente HTTP, el almacén, el token y los temporizadores se
 * inyectan. Nunca bloquea: la app guarda en el teléfono y sigue; esto corre
 * por detrás y se reintenta con espera creciente si algo falla.
 *
 * Estados (`status`):
 *   local        sin sesión o sin servidor configurado: todo queda en el teléfono
 *   checking     preguntando al servidor qué versión tiene
 *   syncing      subiendo / bajando
 *   synced       al día (puede haber operaciones rechazadas, ver `rejected`)
 *   offline      sin conexión; se reintenta sola
 *   error        el servidor falló; se reintenta sola
 *   unsupported  el servidor es v1 (sin /entries): se sincronizará cuando sea v2
 *   auth         la sesión venció (401): nada se borra, espera un login nuevo
 */

const TRANSIENT = (e) => {
  const s = e?.status ?? 0;
  return s === 0 || s === 408 || s === 429 || s >= 500;
};

export function createSyncEngine({
  api,
  getStore,
  getToken,
  onChange = () => {},
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (t) => clearTimeout(t),
  random = Math.random,
  baseDelayMs = 5000,
  maxDelayMs = 5 * 60 * 1000,
  versionTtlMs = { 1: 60 * 1000, 2: 10 * 60 * 1000 },
  concurrency = 3,
} = {}) {
  let state = { status: 'local', apiVersion: null, lastSyncedAt: null, error: null, failures: 0 };
  let versionCheckedAt = 0;
  let running = null;
  let again = false;
  let timer = null;
  let stopped = false;

  const set = (patch) => {
    state = { ...state, ...patch };
    try { onChange(state); } catch { /* la UI no debe romper la sincronización */ }
  };

  const clearRetry = () => {
    if (timer) clearTimer(timer);
    timer = null;
  };

  const scheduleRetry = () => {
    clearRetry();
    if (stopped) return;
    const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, state.failures - 1));
    const delay = Math.round(exp * (0.8 + 0.4 * random()));
    timer = setTimer(() => {
      timer = null;
      return engine.sync({ reason: 'retry' });
    }, delay);
    return delay;
  };

  const detectVersion = async ({ force = false } = {}) => {
    const ttl = versionTtlMs[state.apiVersion] ?? 0;
    if (!force && state.apiVersion != null && now() - versionCheckedAt < ttl) return state.apiVersion;
    try {
      const v = await api.getApiVersion();
      versionCheckedAt = now();
      if (v !== state.apiVersion) set({ apiVersion: v });
      return v;
    } catch {
      return null; // no se sabe (sin conexión): no es lo mismo que v1
    }
  };

  const pushAll = async (store, token) => {
    const ops = store.pendingOps();
    let fatal = null;
    let transient = null;
    let i = 0;

    const pushOne = async (op) => {
      if (op.kind === 'put') {
        const record = store.getRecord(op.col, op.key);
        if (!record) { await store.dropOp(op); return; }
        const saved = op.col === 'entries'
          ? await api.putEntry(token, record)
          : await api.putJournal(token, record);
        await store.markPushed(op, saved);
      } else {
        if (op.col === 'entries') await api.deleteEntry(token, op.key);
        else await api.deleteJournal(token, op.key);
        await store.markPushed(op, null);
      }
    };

    const worker = async () => {
      while (!fatal && !transient && i < ops.length) {
        const op = ops[i];
        i += 1;
        try {
          await pushOne(op);
        } catch (e) {
          if (e?.status === 401) fatal = e;
          else if (TRANSIENT(e) || e?.status === 404) transient = e;
          else await store.markRejected(op, e?.code); // inválida: no se reintenta en bucle
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, ops.length) }, worker));
    if (fatal) throw fatal;
    if (transient) throw transient;
  };

  const runOnce = async () => {
    const store = getStore();
    if (!store) return;
    const token = getToken();
    if (!api.configured || !token) {
      set({ status: 'local', error: null });
      if (api.configured && state.apiVersion == null) await detectVersion();
      return;
    }

    if (state.apiVersion == null) set({ status: 'checking' });
    const version = await detectVersion();
    if (version == null) {
      set({ status: 'offline', error: 'sin_conexion', failures: state.failures + 1 });
      scheduleRetry();
      return;
    }
    if (version < 2) {
      // El servidor aún no guarda el diario. Todo sigue en el teléfono y en la
      // cola; al volver a primer plano se pregunta otra vez.
      clearRetry();
      set({ status: 'unsupported', error: null, failures: 0 });
      return;
    }

    set({ status: 'syncing', error: null });
    try {
      const [serverEntries, serverJournal] = await Promise.all([
        api.listEntries(token),
        api.listJournal(token),
      ]);
      // Si mientras tanto cambió la cuenta (logout / otro login), lo bajado
      // no es de este espacio.
      if (getStore() !== store || getToken() !== token) { again = true; return; }
      await store.applyServerSnapshot('entries', serverEntries);
      await store.applyServerSnapshot('journal', serverJournal);
      await pushAll(store, token);
      clearRetry();
      set({ status: 'synced', lastSyncedAt: new Date(now()).toISOString(), failures: 0, error: null });
    } catch (e) {
      if (e?.status === 401) {
        clearRetry();
        set({ status: 'auth', error: 'sesion_invalida' });
        return;
      }
      if (e?.status === 404) versionCheckedAt = 0; // quizá el servidor volvió a v1
      set({
        status: e?.status === 0 ? 'offline' : 'error',
        error: e?.code ?? 'error',
        failures: state.failures + 1,
      });
      scheduleRetry();
    }
  };

  const engine = {
    getState: () => state,

    /** Pide una sincronización. Si ya hay una en curso, se repite al terminar. */
    sync({ reason } = {}) {
      if (stopped) return Promise.resolve(state);
      if (reason === 'foreground' || reason === 'login') versionCheckedAt = 0;
      if (running) {
        again = true;
        return running;
      }
      running = (async () => {
        do {
          again = false;
          await runOnce();
        } while (again && !stopped);
        return state;
      })().finally(() => { running = null; });
      return running;
    },

    /** Intenta subir lo pendiente sin esperar más de `timeoutMs` (para el logout). */
    async flush(timeoutMs = 8000) {
      let t;
      const timeout = new Promise((resolve) => { t = setTimer(resolve, timeoutMs); });
      try {
        await Promise.race([engine.sync({ reason: 'flush' }), timeout]);
      } finally {
        clearTimer(t);
      }
      return state;
    },

    /** Otra cuenta o sin sesión: se olvidan los fallos y el estado de la anterior. */
    reset() {
      clearRetry();
      set({ status: 'local', lastSyncedAt: null, error: null, failures: 0 });
    },

    detectVersion,

    stop() {
      stopped = true;
      clearRetry();
    },
  };

  return engine;
}
