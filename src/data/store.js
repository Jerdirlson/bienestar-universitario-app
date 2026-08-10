import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEntriesRepository } from './entriesRepository';

/**
 * Único punto donde la app se ata a un almacenamiento concreto.
 *
 * Hoy AsyncStorage: los datos viven en el teléfono y no salen de ahí.
 * Cuando exista el proyecto de Supabase, se cambia el backend aquí — con un
 * paso de migración que suba el histórico local antes de conmutar — y ni la
 * app ni las pruebas se enteran.
 */
const asyncStorageBackend = {
  read: (key) => AsyncStorage.getItem(key),
  write: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};

export const entriesRepository = createEntriesRepository(asyncStorageBackend);
