import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { challengesClient, exerciseLog } from '../../data/wellnessStore';

/**
 * Retos + ejercicios registrados, recargados cada vez que la pantalla gana el
 * foco (por ejemplo, al volver de una sesión de respiración).
 *
 * `apiVersion` lo expone AppContext (1 | 2 | null). Si todavía no existe en el
 * contexto llega undefined y el cliente lo averigua solo (un 404 = v1).
 */
export default function useChallenges() {
  const { sessionToken, apiVersion, lang } = useApp();
  const client = useMemo(
    () => challengesClient({ token: sessionToken, apiVersion, lang }),
    [sessionToken, apiVersion, lang],
  );

  const [challenges, setChallenges] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(client.mode);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const reload = useCallback(async () => {
    setError(null);
    const [c, ex] = await Promise.allSettled([client.list(), exerciseLog.list()]);
    if (!alive.current) return;
    if (c.status === 'fulfilled') setChallenges(c.value);
    else setError(c.reason);
    if (ex.status === 'fulfilled') setExercises(ex.value);
    setMode(client.mode);
    setLoading(false);
  }, [client]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return { client, challenges, exercises, loading, error, mode, reload };
}
