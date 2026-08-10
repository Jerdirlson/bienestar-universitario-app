import { dayKey } from '../lib/dates.js';

/**
 * Forma canónica de un check-in, idéntica a la tabla `entries` de Postgres.
 *
 * Las mismas reglas se validan aquí y allá a propósito: si el almacenamiento
 * local aceptara datos que la base rechaza, la migración a Supabase empezaría a
 * fallar con entradas que llevaban meses guardadas.
 *
 *   entryDate  'AAAA-MM-DD' en hora local · uno por día, el último gana
 *   mood       0..4
 *   feelings   claves estables ('tranquile'), no etiquetas traducidas
 *   causes     claves estables ('estudios')
 *   note       texto libre del diario, hasta 4000 caracteres
 */

export const MOOD_MIN = 0;
export const MOOD_MAX = 4;
export const NOTE_MAX = 4000;

export class InvalidEntryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidEntryError';
  }
}

const isDayKey = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const cleanKeys = (value, field) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new InvalidEntryError(`${field} debe ser un arreglo`);
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new InvalidEntryError(`${field} solo acepta claves de texto`);
    }
    seen.add(item.trim());
  }
  return [...seen];
};

/** Normaliza y valida. Lanza InvalidEntryError si algo no cumple. */
export function normalizeEntry(input, now = new Date()) {
  if (!input || typeof input !== 'object') {
    throw new InvalidEntryError('la entrada debe ser un objeto');
  }

  const entryDate = input.entryDate ?? dayKey(now);
  if (!isDayKey(entryDate)) {
    throw new InvalidEntryError(`entryDate inválida: ${String(input.entryDate)}`);
  }

  const mood = input.mood;
  if (!Number.isInteger(mood) || mood < MOOD_MIN || mood > MOOD_MAX) {
    throw new InvalidEntryError(`mood debe ser un entero entre ${MOOD_MIN} y ${MOOD_MAX}`);
  }

  const note = input.note ?? '';
  if (typeof note !== 'string') throw new InvalidEntryError('note debe ser texto');
  if (note.length > NOTE_MAX) {
    throw new InvalidEntryError(`note supera ${NOTE_MAX} caracteres`);
  }

  const nowIso = now.toISOString();
  return {
    entryDate,
    mood,
    feelings: cleanKeys(input.feelings, 'feelings'),
    causes: cleanKeys(input.causes, 'causes'),
    note,
    createdAt: input.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
}
