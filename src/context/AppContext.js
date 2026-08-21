import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { COPY } from '../i18n';
import { entriesRepository } from '../data/store';
import { dayKey } from '../lib/dates';
import { computeStreak } from '../lib/streak';
import { getStoredToken, clearSession, getMe } from '../data/session';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [lang, setLang] = useState('es');

  // Token del login (src/data/session.js). null mientras se consulta el
  // almacenamiento o si no hay sesión — sessionReady distingue esos dos
  // casos para que Splash no navegue antes de saber cuál es cuál.
  const [sessionToken, setSessionToken] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Perfil real, cargado del API tras el login — no de lo que se haya escrito
  // en un formulario, para que refleje lo que la base realmente tiene atado
  // al token. userName queda en null hasta que la persona le ponga un
  // display_name (ver ProfileScreen): preferimos saludar sin nombre antes
  // que inventar uno con el correo.
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserNameState] = useState(null);
  const [memberSince, setMemberSince] = useState(null);
  // 'student' salvo que alguien lo suba a mano en la base (ver ProfileScreen
  // / CommunityScreen: solo moderator/admin ven controles de moderación).
  const [userRole, setUserRole] = useState(null);

  const loadProfile = useCallback(async (token) => {
    const me = await getMe(token);
    setUserEmail(me.email);
    setUserNameState(me.display_name ?? null);
    setMemberSince(me.created_at ?? null);
    setUserRole(me.role ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getStoredToken().catch(() => null);
      if (!cancelled) {
        setSessionToken(token);
        setSessionReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!sessionToken) { setUserEmail(null); setUserNameState(null); setMemberSince(null); setUserRole(null); return; }
    let cancelled = false;
    loadProfile(sessionToken).catch(() => {
      // Un token que ya no sirve (venció, o la firma cambió) no debe dejar la
      // app mostrando una sesión a medias.
      if (!cancelled) { setSessionToken(null); }
    });
    return () => { cancelled = true; };
  }, [sessionToken, loadProfile]);

  // Para después de editar el nombre en ProfileScreen: vuelve a pedir el
  // perfil en vez de confiar en lo que se mandó a guardar, para que la UI
  // muestre exactamente lo que la base terminó aceptando.
  const refreshProfile = useCallback(() => {
    if (sessionToken) return loadProfile(sessionToken);
    return Promise.resolve();
  }, [sessionToken, loadProfile]);

  const completeLogin = useCallback((token) => setSessionToken(token), []);
  const logout = useCallback(async () => {
    await clearSession();
    setSessionToken(null);
  }, []);

  // Check-ins guardados. Se cargan del almacenamiento al arrancar.
  const [entries, setEntries] = useState([]);
  // Mientras es false no sabemos si hay histórico: sirve para no mostrar el
  // estado vacío ("empieza tu racha") un instante antes de leer el disco.
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(null);

  // Borrador del check-in en curso.
  const [mood, setMood] = useState(3);
  const [feelings, setFeelings] = useState([]);
  const [causes, setCauses] = useState([]);
  const [journalText, setJournalText] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await entriesRepository.list();
        if (!cancelled) setEntries(stored);
      } catch (e) {
        // Sin histórico la app sigue siendo usable, así que arrancamos vacíos
        // y dejamos el error a la vista en vez de fallar el arranque.
        if (!cancelled) setStorageError(e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const streak = useMemo(() => computeStreak(entries), [entries]);

  const t = COPY[lang];
  const toggleLang = () => setLang(l => (l === 'es' ? 'en' : 'es'));

  /**
   * Cierra el check-in en curso y lo guarda. Un registro por día: el último gana.
   * Acepta overrides porque quien llama suele tener el valor más fresco que el
   * estado (un setState del mismo evento todavía no se ha propagado).
   */
  const saveEntry = useCallback(async (overrides = {}) => {
    const saved = await entriesRepository.upsert({
      mood, feelings, causes, note: journalText,
      ...overrides,
    });

    setEntries(prev => [saved, ...prev.filter(e => e.entryDate !== saved.entryDate)]);
    setFeelings([]);
    setCauses([]);
    setJournalText('');
    return saved;
  }, [mood, feelings, causes, journalText]);

  const entryForDay = useCallback(
    (date) => entries.find(e => e.entryDate === dayKey(date)) ?? null,
    [entries]
  );

  return (
    <AppContext.Provider value={{
      lang, toggleLang, t,
      userName, userEmail, memberSince, userRole, refreshProfile,
      sessionToken, sessionReady, completeLogin, logout,
      entries, saveEntry, entryForDay, ready, storageError,
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
