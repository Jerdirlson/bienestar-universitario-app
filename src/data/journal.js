import { isUuid, uuidv4 } from '../lib/uuid.js';
import { InvalidEntryError, MOOD_MIN, MOOD_MAX } from './entry.js';

/**
 * Forma canónica de una entrada del diario libre, igual a `journal_entries`
 * (ver api/API.md, "Diario libre"). Varias por día.
 *
 *   id         uuid v4 generado en el cliente
 *   title      hasta 120 caracteres (puede ir vacío)
 *   body       1 a 10000 caracteres
 *   promptKey  clave del prompt guiado ('gratitude'…) o null · hasta 40
 *   mood       0..4 o null
 *
 * Mismas reglas que la base: lo que el teléfono acepta hoy lo tiene que
 * aceptar el servidor cuando se sincronice.
 */

export const JOURNAL_TITLE_MAX = 120;
export const JOURNAL_BODY_MAX = 10000;
export const JOURNAL_PROMPT_MAX = 40;

export function normalizeJournal(input, now = new Date(), newId = uuidv4) {
  if (!input || typeof input !== 'object') {
    throw new InvalidEntryError('la entrada debe ser un objeto');
  }

  const id = input.id ?? newId();
  if (!isUuid(id)) throw new InvalidEntryError(`id inválido: ${String(input.id)}`);

  const title = input.title ?? '';
  if (typeof title !== 'string') throw new InvalidEntryError('title debe ser texto');
  const cleanTitle = title.trim();
  if (cleanTitle.length > JOURNAL_TITLE_MAX) {
    throw new InvalidEntryError(`title supera ${JOURNAL_TITLE_MAX} caracteres`);
  }

  const body = input.body;
  if (typeof body !== 'string') throw new InvalidEntryError('body debe ser texto');
  // Se quitan solo los espacios de los extremos: el formato interno (saltos de
  // línea, listas) es parte de lo que la persona escribió.
  const cleanBody = body.replace(/^\s+|\s+$/g, '');
  if (cleanBody.length < 1) throw new InvalidEntryError('body vacío');
  if (cleanBody.length > JOURNAL_BODY_MAX) {
    throw new InvalidEntryError(`body supera ${JOURNAL_BODY_MAX} caracteres`);
  }

  const promptKey = input.promptKey ?? null;
  if (promptKey !== null) {
    if (typeof promptKey !== 'string' || promptKey.length === 0 || promptKey.length > JOURNAL_PROMPT_MAX) {
      throw new InvalidEntryError('promptKey inválida');
    }
  }

  const mood = input.mood ?? null;
  if (mood !== null && (!Number.isInteger(mood) || mood < MOOD_MIN || mood > MOOD_MAX)) {
    throw new InvalidEntryError(`mood debe ser null o un entero entre ${MOOD_MIN} y ${MOOD_MAX}`);
  }

  const nowIso = now.toISOString();
  return {
    id: id.toLowerCase(),
    title: cleanTitle,
    body: cleanBody,
    promptKey,
    mood,
    createdAt: input.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
}
