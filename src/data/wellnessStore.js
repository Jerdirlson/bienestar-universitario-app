import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { createChallengesClient } from './challenges';
import { createExerciseLog } from './exercises';

/**
 * Enlace de la capa de bienestar con la plataforma (AsyncStorage y fetch).
 * La lógica vive en challenges.js / exercises.js, que se prueban en Node.
 */
const storage = {
  read: (key) => AsyncStorage.getItem(key),
  write: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};

export const exerciseLog = createExerciseLog(storage);

export function challengesClient({ token, apiVersion, lang }) {
  return createChallengesClient({
    apiUrl: API_URL,
    token,
    apiVersion,
    fetchImpl: (...args) => fetch(...args),
    storage,
    lang,
  });
}

/**
 * Tras una sesión de respiración: si la persona está en el reto de
 * respiración y hoy no lo ha registrado, suma el día. Devuelve el reto
 * actualizado o null si no correspondía. Nunca lanza: el ejercicio ya quedó
 * guardado y un fallo de red aquí no debe arruinar ese momento.
 */
export async function creditBreathingChallenge({ token, apiVersion, lang }) {
  try {
    const client = challengesClient({ token, apiVersion, lang });
    const list = await client.list();
    const c = list.find(x => x.key === 'breathing_7');
    if (!c || !c.joined || c.completed_at || c.checked_today) return null;
    await client.checkIn('breathing_7');
    const fresh = await client.list();
    return fresh.find(x => x.key === 'breathing_7') ?? null;
  } catch {
    return null;
  }
}
