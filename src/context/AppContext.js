import React, { createContext, useContext, useMemo, useState } from 'react';
import { COPY } from '../i18n';
import { dayKey } from '../lib/dates';
import { computeStreak } from '../lib/streak';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [lang, setLang] = useState('es');

  // Nombre real de la persona. Queda en null hasta que exista autenticación:
  // preferimos saludar sin nombre antes que inventar uno.
  const [userName, setUserName] = useState(null);

  // Check-ins registrados. Hoy viven solo en memoria y se pierden al cerrar
  // la app — falta definir la capa de persistencia.
  const [entries, setEntries] = useState([]);

  // Borrador del check-in en curso.
  const [mood, setMood] = useState(3);
  const [feelings, setFeelings] = useState([]);
  const [causes, setCauses] = useState([]);
  const [journalText, setJournalText] = useState('');

  const streak = useMemo(() => computeStreak(entries), [entries]);

  const t = COPY[lang];
  const toggleLang = () => setLang(l => (l === 'es' ? 'en' : 'es'));

  /**
   * Cierra el check-in en curso y lo guarda. Un registro por día: el último gana.
   * Acepta overrides porque quien llama suele tener el valor más fresco que el
   * estado (un setState del mismo evento todavía no se ha propagado).
   */
  const saveEntry = (overrides = {}) => {
    const now = new Date();
    const key = dayKey(now);
    const entry = {
      date: now.toISOString(),
      mood, feelings, causes, note: journalText,
      ...overrides,
    };

    setEntries(prev => [...prev.filter(e => dayKey(new Date(e.date)) !== key), entry]);
    setFeelings([]);
    setCauses([]);
    setJournalText('');
  };

  const entryForDay = (date) => {
    const key = dayKey(date);
    return entries.find(e => dayKey(new Date(e.date)) === key) ?? null;
  };

  return (
    <AppContext.Provider value={{
      lang, toggleLang, t,
      userName, setUserName,
      entries, saveEntry, entryForDay,
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
