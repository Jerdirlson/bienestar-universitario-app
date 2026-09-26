import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { COPY } from '../i18n';
import { diaryStoreFor, diaryApi, prefs, PREF_KEYS } from '../data/store';
import { GUEST_NAMESPACE } from '../data/diaryStore';
import { createSyncEngine } from '../data/diarySync';
import { dayKey } from '../lib/dates';
import { computeStreak } from '../lib/streak';
import { getStoredToken, clearSession, getMe } from '../data/session';
import { trustedCachedProfile, adoptionPrompt } from '../lib/accountSwitch';
import { showAlert } from '../components/dialogs';
import { ONBOARDED_VALUE, hasOnboarded, parseFocus, serializeFocus, toggleFocus } from '../lib/onboarding';

const AppContext = createContext(null);

const EMPTY_SNAPSHOT = { entries: [], journal: [], pending: 0, rejected: 0, lastPullAt: null };

const toDayKey = (date) => (typeof date === 'string' ? date : dayKey(date ?? new Date()));

export function AppProvider({ children }) {
  const [lang, setLangState] = useState('es');
  // Para textos que se muestran desde callbacks asíncronos (el aviso de adoptar).
  const langRef = useRef('es');
  langRef.current = lang;

  // Token del login (src/data/session.js). null mientras se consulta el
  // almacenamiento o si no hay sesión — sessionReady distingue esos dos
  // casos para que Splash no navegue antes de saber cuál es cuál.
  const [sessionToken, setSessionToken] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  // true cuando el servidor rechazó el token guardado (venció o la firma
  // cambió): la navegación lleva al login y este explica por qué.
  const [sessionExpired, setSessionExpired] = useState(false);

  // Si ya se vio (o saltó) el onboarding alguna vez en este teléfono —
  // src/lib/onboarding.js decide con esto a dónde navega Splash. Empieza en
  // false y se corrige en el mismo arranque que lee sessionReady, así que
  // ambos quedan listos juntos.
  const [onboardingDone, setOnboardingDone] = useState(false);
  // Enfoque elegido en el paso de personalización (claves de FOCUS_OPTIONS).
  // Solo se usa para resaltar contenido en ExploreScreen.js.
  const [onboardingFocus, setOnboardingFocusState] = useState([]);

  // Perfil completo de GET /auth/me (id, email, display_name, role, locale,
  // created_at, public_id, avatar_emoji, avatar_color, bio). Se guarda en el
  // teléfono para poder abrir la app sin red; siempre se refresca del API.
  const [profile, setProfile] = useState(null);

  // Espacio del diario en el teléfono: el id de la cuenta, o 'guest'. null
  // hasta que el arranque decide cuál abrir.
  const [diaryUserId, setDiaryUserId] = useState(null);
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  // Mientras es false no sabemos si hay histórico: sirve para no mostrar el
  // estado vacío ("empieza tu racha") un instante antes de leer el disco.
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(null);

  // Borrador del check-in en curso. draftDate null = hoy.
  const [mood, setMood] = useState(3);
  const [feelings, setFeelings] = useState([]);
  const [causes, setCauses] = useState([]);
  const [journalText, setJournalText] = useState('');
  const [draftDate, setDraftDate] = useState(null);

  const tokenRef = useRef(null);
  // Dueño verificado del token actual (id de /auth/me). La sincronización solo
  // corre cuando coincide con el espacio abierto: el diario de una cuenta
  // nunca se sube con el token de otra.
  const tokenOwnerRef = useRef(null);
  const storeRef = useRef(null);

  const [sync, setSync] = useState({ status: 'local', apiVersion: null, lastSyncedAt: null, error: null });
  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current = createSyncEngine({
      api: diaryApi,
      getStore: () => {
        const s = storeRef.current;
        return s && s.namespace !== GUEST_NAMESPACE ? s : null;
      },
      getToken: () => {
        const s = storeRef.current;
        return s && tokenOwnerRef.current === s.namespace ? tokenRef.current : null;
      },
      onChange: (s) => setSync(s),
    });
  }
  const engine = engineRef.current;
  const requestSync = useCallback((reason) => { engine.sync({ reason }).catch(() => {}); }, [engine]);

  // ── arranque ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, storedLang, cachedRaw, onboardedRaw, focusRaw] = await Promise.all([
        getStoredToken().catch(() => null),
        prefs.get(PREF_KEYS.lang).catch(() => null),
        prefs.get(PREF_KEYS.profile).catch(() => null),
        prefs.get(PREF_KEYS.onboarded).catch(() => null),
        prefs.get(PREF_KEYS.onboardingFocus).catch(() => null),
      ]);
      if (cancelled) return;
      let cached = null;
      try { cached = cachedRaw ? JSON.parse(cachedRaw) : null; } catch { cached = null; }

      if (storedLang === 'es' || storedLang === 'en') setLangState(storedLang);
      setOnboardingDone(hasOnboarded(onboardedRaw));
      setOnboardingFocusState(parseFocus(focusRaw));
      tokenRef.current = token;
      // El perfil en caché solo se cree si es del dueño del token (el `sub`
      // del JWT). Si no coincide —p. ej. el token es de B y la caché quedó de
      // A— se arranca sin sesión en el diario hasta que /auth/me lo confirme:
      // así nunca se sube el diario de A con el token de B.
      const trusted = trustedCachedProfile(token, cached);
      if (trusted) {
        tokenOwnerRef.current = trusted.id;
        setProfile(trusted);
        setDiaryUserId(trusted.id);
      } else {
        if (cached) prefs.remove(PREF_KEYS.profile).catch(() => {});
        setDiaryUserId(GUEST_NAMESPACE);
      }
      setSessionToken(token);
      setSessionReady(true);
      engine.detectVersion().catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [engine]);

  const loadProfile = useCallback(async (token) => {
    const me = await getMe(token);
    if (tokenRef.current !== token) return me; // llegó tarde: ya hay otra sesión
    tokenOwnerRef.current = me.id;
    setProfile(me);
    setDiaryUserId(me.id);
    prefs.set(PREF_KEYS.profile, JSON.stringify(me)).catch(() => {});
    requestSync('login');
    return me;
  }, [requestSync]);

  useEffect(() => {
    tokenRef.current = sessionToken;
    if (!sessionToken) return;
    let cancelled = false;
    loadProfile(sessionToken).catch((e) => {
      if (cancelled) return;
      // Token rechazado (venció o la firma cambió): se cierra la sesión en la
      // interfaz, pero el diario local de esa cuenta se queda intacto y
      // pendiente de subir. Sin red, en cambio, seguimos con el perfil en
      // caché: estar offline no es lo mismo que perder la sesión.
      if (e?.status === 401 || e?.status === 403) {
        tokenRef.current = null;
        tokenOwnerRef.current = null;
        setProfile(null);
        setSessionToken(null);
        // Se olvida también el token guardado: si no, cada arranque volvía a
        // entrar con él y la persona quedaba en la app sin sesión (la
        // comunidad vacía, nada se sincronizaba) sin que nada le pidiera
        // volver a entrar. El diario del teléfono no se toca.
        clearSession().catch(() => {});
        prefs.remove(PREF_KEYS.profile).catch(() => {});
        // Sin sesión, el diario de esa cuenta deja de estar a la vista: se
        // pasa al espacio sin sesión. El de la cuenta queda intacto en el
        // teléfono (con lo pendiente de subir) para cuando vuelva a entrar.
        engine.reset();
        storeRef.current = null;
        setSnapshot(EMPTY_SNAPSHOT);
        setDiaryUserId(GUEST_NAMESPACE);
        setSessionExpired(true);
      }
    });
    return () => { cancelled = true; };
  }, [sessionToken, loadProfile, engine]);

  // Para después de editar el perfil: vuelve a pedirlo en vez de confiar en
  // lo que se mandó a guardar, para que la UI muestre lo que la base aceptó.
  const refreshProfile = useCallback(() => {
    if (sessionToken) return loadProfile(sessionToken);
    return Promise.resolve();
  }, [sessionToken, loadProfile]);

  const completeLogin = useCallback((token) => {
    setSessionExpired(false);
    tokenRef.current = token;
    tokenOwnerRef.current = null; // se sabrá de quién es cuando responda /auth/me
    // Lo que hubiera en pantalla era de la sesión anterior: fuera el perfil, y
    // el diario vuelve al espacio sin sesión hasta que /auth/me diga de quién
    // es este token (loadProfile abre entonces el espacio de esa cuenta).
    setProfile(null);
    if (storeRef.current && storeRef.current.namespace !== GUEST_NAMESPACE) {
      engine.reset();
      storeRef.current = null;
      setSnapshot(EMPTY_SNAPSHOT);
      setDiaryUserId(GUEST_NAMESPACE);
    }
    setSessionToken(token);
  }, [engine]);

  /**
   * Lo escrito sin sesión (y el histórico de antes de la sincronización,
   * raiz.entries.v1, que se carga en el espacio sin sesión) NO pasa solo a la
   * cuenta que entra: en un teléfono compartido puede ser de otra persona. Se
   * pregunta mostrando cuántas entradas hay; "no" es la opción segura — quedan
   * en el teléfono, sin subir, en el espacio sin sesión. Si dice que no, no se
   * vuelve a preguntar por ese mismo contenido en cada arranque.
   */
  const offerAdoption = useCallback(async (store, accountId, isCancelled) => {
    try {
      const guest = diaryStoreFor(GUEST_NAMESPACE);
      await guest.load();
      let declined = {};
      try { declined = JSON.parse((await prefs.get(PREF_KEYS.adoptDeclined)) || '{}') ?? {}; } catch { declined = {}; }
      const { ask, count, signature } = adoptionPrompt(guest.getSnapshot(), declined, accountId);
      if (!ask || isCancelled()) return;
      const copy = COPY[langRef.current];
      const body = count === 1 ? copy.diaryAdoptBodyOne : copy.diaryAdoptBody.replace('{n}', String(count));
      showAlert(copy.diaryAdoptTitle, body, [
        {
          text: copy.diaryAdoptNo,
          style: 'cancel',
          onPress: () => {
            prefs.set(PREF_KEYS.adoptDeclined, JSON.stringify({ ...declined, [accountId]: signature })).catch(() => {});
          },
        },
        {
          text: copy.diaryAdoptYes,
          onPress: async () => {
            // Solo si esa cuenta sigue abierta: si entre tanto cambió la
            // sesión, no se adopta en la equivocada.
            if (storeRef.current !== store) return;
            try {
              await store.adoptFrom(guest);
              requestSync('save');
            } catch (e) {
              setStorageError(e);
            }
          },
        },
      ], { cancelable: false });
    } catch {
      // Sin poder leer el espacio sin sesión no se ofrece nada: lo seguro.
    }
  }, [requestSync]);

  // ── diario local ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!diaryUserId) return undefined;
    let cancelled = false;
    let unsubscribe = null;
    const store = diaryStoreFor(diaryUserId);
    (async () => {
      try {
        await store.load();
      } catch (e) {
        // Sin histórico la app sigue siendo usable: arrancamos vacíos y
        // dejamos el error a la vista en vez de fallar el arranque.
        if (!cancelled) setStorageError(e);
      }
      if (cancelled) return;
      storeRef.current = store;
      setSnapshot(store.getSnapshot());
      unsubscribe = store.subscribe(setSnapshot);
      setReady(true);
      if (diaryUserId === GUEST_NAMESPACE) engine.reset();
      requestSync('start');
      if (diaryUserId !== GUEST_NAMESPACE) offerAdoption(store, diaryUserId, () => cancelled);
    })();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [diaryUserId, engine, requestSync, offerAdoption]);

  // Al volver a primer plano: sincroniza (y vuelve a preguntar si el servidor ya es v2).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') requestSync('foreground');
    });
    return () => sub?.remove?.();
  }, [requestSync]);

  useEffect(() => () => engine.stop(), [engine]);

  const requireStore = () => {
    const s = storeRef.current;
    if (!s) throw new Error('diario_no_listo');
    return s;
  };

  /**
   * Cierra sesión. Primero intenta subir lo pendiente (hasta 8 s) y luego
   * borra el diario de este teléfono. Si algo no se pudo subir (sin conexión,
   * servidor v1), se conserva solo eso, en el espacio de esa cuenta, para
   * subirlo cuando vuelva a entrar; `discardUnsynced: true` lo borra también.
   * Devuelve { unsynced } con cuántos cambios quedaron sin subir.
   */
  const logout = useCallback(async ({ discardUnsynced = false } = {}) => {
    const store = storeRef.current;
    let unsynced = 0;
    if (store && store.namespace !== GUEST_NAMESPACE) {
      try { await engine.flush(8000); } catch { /* sin red: se conserva lo pendiente */ }
      try { unsynced = await store.wipe({ keepPending: !discardUnsynced }); } catch { /* nada más que hacer */ }
    }
    await clearSession();
    await prefs.remove(PREF_KEYS.profile).catch(() => {});
    tokenRef.current = null;
    tokenOwnerRef.current = null;
    engine.reset();
    setProfile(null);
    setSessionToken(null);
    if (store && store.namespace !== GUEST_NAMESPACE) {
      // El efecto del diario abre el espacio sin sesión al cambiar diaryUserId.
      storeRef.current = null;
      setSnapshot(EMPTY_SNAPSHOT);
      setDiaryUserId(GUEST_NAMESPACE);
    }
    setFeelings([]);
    setCauses([]);
    setJournalText('');
    setDraftDate(null);
    return { unsynced };
  }, [engine]);

  // ── idioma (guardado en el teléfono) ───────────────────────────────────────
  const setLang = useCallback((l) => {
    if (l !== 'es' && l !== 'en') return;
    setLangState(l);
    prefs.set(PREF_KEYS.lang, l).catch(() => {});
  }, []);
  const toggleLang = useCallback(() => {
    setLangState((l) => {
      const next = l === 'es' ? 'en' : 'es';
      prefs.set(PREF_KEYS.lang, next).catch(() => {});
      return next;
    });
  }, []);
  const t = COPY[lang];

  // ── onboarding (guardado en el teléfono, no en la cuenta) ──────────────────
  // Se llama al terminar el recorrido (botón final) o al tocar "Saltar": en
  // ambos casos cuenta como "ya lo vio" y Splash no debe repetirlo.
  const completeOnboarding = useCallback(() => {
    setOnboardingDone(true);
    prefs.set(PREF_KEYS.onboarded, ONBOARDED_VALUE).catch(() => {});
  }, []);
  const toggleOnboardingFocus = useCallback((key) => {
    setOnboardingFocusState((prev) => {
      const next = toggleFocus(prev, key);
      prefs.set(PREF_KEYS.onboardingFocus, serializeFocus(next)).catch(() => {});
      return next;
    });
  }, []);

  // ── check-in ───────────────────────────────────────────────────────────────
  const entries = snapshot.entries;
  const journal = snapshot.journal;
  const streak = useMemo(() => computeStreak(entries), [entries]);

  const entryForDay = useCallback(
    (date) => entries.find((e) => e.entryDate === toDayKey(date)) ?? null,
    [entries]
  );

  /**
   * Prepara el borrador para registrar (o editar) el check-in de un día. Si
   * ese día ya tiene uno, lo precarga para editarlo. Devuelve el existente o null.
   */
  const startCheckin = useCallback(({ date = null, initialMood } = {}) => {
    const asKey = date ? toDayKey(date) : null;
    const key = asKey === dayKey(new Date()) ? null : asKey; // hoy = null
    const existing = entries.find((e) => e.entryDate === (key ?? dayKey(new Date()))) ?? null;
    setDraftDate(key);
    setMood(Number.isInteger(initialMood) ? initialMood : (existing?.mood ?? 3));
    setFeelings(existing?.feelings ?? []);
    setCauses(existing?.causes ?? []);
    setJournalText(existing?.note ?? '');
    return existing;
  }, [entries]);

  /**
   * Cierra el check-in en curso y lo guarda en el teléfono al instante; la
   * subida va por detrás. Un registro por día: el último gana.
   * Acepta overrides porque quien llama suele tener el valor más fresco que el
   * estado (un setState del mismo evento todavía no se ha propagado).
   */
  const saveEntry = useCallback(async (overrides = {}) => {
    const input = { mood, feelings, causes, note: journalText, ...overrides };
    if (draftDate && !input.entryDate) input.entryDate = draftDate;
    const saved = await requireStore().saveEntry(input);
    setFeelings([]);
    setCauses([]);
    setJournalText('');
    setDraftDate(null);
    requestSync('save');
    return saved;
  }, [mood, feelings, causes, journalText, draftDate, requestSync]);

  const deleteEntry = useCallback(async (date) => {
    const ok = await requireStore().deleteEntry(toDayKey(date));
    requestSync('save');
    return ok;
  }, [requestSync]);

  // ── diario libre ───────────────────────────────────────────────────────────
  const journalById = useCallback((id) => journal.find((j) => j.id === String(id).toLowerCase()) ?? null, [journal]);

  const saveJournal = useCallback(async (input) => {
    const saved = await requireStore().saveJournal(input);
    requestSync('save');
    return saved;
  }, [requestSync]);

  const deleteJournal = useCallback(async (id) => {
    const ok = await requireStore().deleteJournal(id);
    requestSync('save');
    return ok;
  }, [requestSync]);

  const getJournalDraft = useCallback((key) => storeRef.current?.getDraft(key) ?? null, []);
  const setJournalDraft = useCallback((key, value) => {
    const s = storeRef.current;
    return s ? s.setDraft(key, value) : Promise.resolve();
  }, []);

  const syncStatus = useMemo(() => ({
    state: sync.status,
    pending: snapshot.pending,
    rejected: snapshot.rejected,
    lastSyncedAt: sync.lastSyncedAt,
    error: sync.error,
  }), [sync, snapshot.pending, snapshot.rejected]);

  const syncNow = useCallback(() => engine.sync({ reason: 'manual' }), [engine]);

  return (
    <AppContext.Provider value={{
      lang, setLang, toggleLang, t,
      onboardingDone, completeOnboarding, onboardingFocus, toggleOnboardingFocus,
      profile,
      userName: profile?.display_name ?? null,
      userEmail: profile?.email ?? null,
      memberSince: profile?.created_at ?? null,
      userRole: profile?.role ?? null,
      refreshProfile,
      sessionToken, sessionReady, sessionExpired, completeLogin, logout,
      apiVersion: sync.apiVersion, syncStatus, syncNow,
      entries, saveEntry, deleteEntry, entryForDay, startCheckin, draftDate,
      ready, storageError,
      journal, journalById, saveJournal, deleteJournal, getJournalDraft, setJournalDraft,
      mood, setMood,
      feelings, setFeelings,
      causes, setCauses,
      journalText, setJournalText,
      streak,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
