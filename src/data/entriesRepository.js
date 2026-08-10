import { normalizeEntry } from './entry.js';

export const STORAGE_KEY = 'raiz.entries.v1';

/**
 * Repositorio de check-ins.
 *
 * Este módulo es deliberadamente puro: no importa nada de React Native, así que
 * se puede ejecutar y probar en Node directamente. El enlace con AsyncStorage
 * vive en store.js.
 *
 * `backend` es una interfaz mínima — read/write/remove sobre una clave — para
 * que la lógica se pueda probar contra memoria sin simular el módulo nativo.
 *
 * Cuando exista el proyecto de Supabase, lo que cambia es el backend que se le
 * inyecta: la app consume `list` / `upsert` / `clear` y no sabe dónde viven los
 * datos. Las validaciones de entry.js ya coinciden con las restricciones de la
 * tabla, así que lo que se guarda hoy en el teléfono entra en Postgres tal cual.
 */
export function createEntriesRepository(backend) {
  const readAll = async () => {
    const raw = await backend.read(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Guardado corrupto: preferimos empezar limpio antes que dejar la app
      // en pantalla blanca. Se pierde el histórico local, no un dato remoto.
      return [];
    }
  };

  const sortNewestFirst = (list) =>
    [...list].sort((a, b) => (a.entryDate < b.entryDate ? 1 : a.entryDate > b.entryDate ? -1 : 0));

  return {
    /** Check-ins guardados, del más reciente al más antiguo. */
    async list() {
      return sortNewestFirst(await readAll());
    },

    async getByDate(entryDate) {
      const all = await readAll();
      return all.find((e) => e.entryDate === entryDate) ?? null;
    },

    /**
     * Guarda un check-in. Un registro por día: si ya existe uno para esa fecha
     * lo reemplaza, conservando su createdAt original.
     * Mismo comportamiento que el `unique (user_id, entry_date)` de la tabla.
     */
    async upsert(input, now = new Date()) {
      const all = await readAll();

      // Normalizamos antes de buscar el registro previo: la fecha suele venir
      // implícita ("hoy"), así que sin resolverla primero la búsqueda compararía
      // contra undefined, nunca encontraría el registro del día y perdería su
      // createdAt original.
      const draft = normalizeEntry(input, now);
      const previous = all.find((e) => e.entryDate === draft.entryDate);
      const entry = previous ? { ...draft, createdAt: previous.createdAt } : draft;

      const next = [...all.filter((e) => e.entryDate !== entry.entryDate), entry];
      await backend.write(STORAGE_KEY, JSON.stringify(next));
      return entry;
    },

    /** Borra todo el histórico local. Se usa al cerrar sesión. */
    async clear() {
      await backend.remove(STORAGE_KEY);
    },
  };
}

/** Backend en memoria, para pruebas. */
export function createMemoryBackend(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    read: async (key) => (map.has(key) ? map.get(key) : null),
    write: async (key, value) => { map.set(key, value); },
    remove: async (key) => { map.delete(key); },
  };
}
