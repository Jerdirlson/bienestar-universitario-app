import { dayKey } from '../lib/dates.js';

/**
 * Registro local de ejercicios guiados hechos (respiración, grounding).
 * Solo vive en el teléfono: sirve para los logros y para sumar el día del reto
 * de respiración. Lógica pura; el almacenamiento se inyecta.
 */

export const EXERCISES_STORAGE_KEY = 'raiz.exercises.v1';
const MAX_RECORDS = 1000;

export const EXERCISE_KINDS = ['breathing', 'grounding'];

export function createExerciseLog(storage) {
  const readAll = async () => {
    const raw = await storage.read(EXERCISES_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return {
    async list() {
      return readAll();
    },

    /** Guarda un ejercicio terminado. `date` es el día local. */
    async record({ kind, technique = null, seconds = 0 }, now = new Date()) {
      if (!EXERCISE_KINDS.includes(kind)) throw new Error(`ejercicio desconocido: ${kind}`);
      const rec = {
        kind,
        technique,
        seconds: Math.max(0, Math.round(Number(seconds) || 0)),
        date: dayKey(now),
        at: now.toISOString(),
      };
      const all = await readAll();
      const next = [...all, rec].slice(-MAX_RECORDS);
      await storage.write(EXERCISES_STORAGE_KEY, JSON.stringify(next));
      return rec;
    },
  };
}

export function summarizeExercises(list = []) {
  const byKind = (k) => list.filter(r => r.kind === k);
  return {
    total: list.length,
    breathing: byKind('breathing').length,
    grounding: byKind('grounding').length,
    breathingDays: new Set(byKind('breathing').map(r => r.date)).size,
  };
}
