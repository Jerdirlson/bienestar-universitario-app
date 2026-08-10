import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { COPY } from '../i18n';
import { entriesRepository } from '../data/store';
import { dayKey } from '../lib/dates';
import { computeStreak } from '../lib/streak';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [lang, setLang] = useState('es');

  // Nombre real de la persona. Queda en null hasta que exista autenticación:
  // preferimos saludar sin nombre antes que inventar uno.
  const [userName, setUserName] = useState(null);

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
      userName, setUserName,
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
