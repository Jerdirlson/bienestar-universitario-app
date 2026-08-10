import React, { createContext, useContext, useState } from 'react';
import { COPY } from '../i18n';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [lang, setLang] = useState('es');
  const [mood, setMood] = useState(3);
  const [feelings, setFeelings] = useState([]);
  const [causes, setCauses] = useState(['sueno']);
  const [journalText, setJournalText] = useState('Dormí muy bien anoche y me siento con energía para enfrentar el día.');
  const streak = 5;

  const t = COPY[lang];
  const toggleLang = () => setLang(l => l === 'es' ? 'en' : 'es');

  return (
    <AppContext.Provider value={{
      lang, toggleLang, t,
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
