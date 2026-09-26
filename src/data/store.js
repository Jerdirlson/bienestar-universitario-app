import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEntriesRepository } from './entriesRepository';
import { createDiaryStore } from './diaryStore';
import { createDiaryApi } from './diaryApi';
import { API_URL } from '../config';

/**
 * Único punto donde el diario se ata a un almacenamiento y a una red
 * concretos. La lógica (diaryStore, diarySync, diaryApi) es pura y se prueba
 * en Node con memoria y un fetch simulado.
 */
export const asyncStorageBackend = {
  read: (key) => AsyncStorage.getItem(key),
  write: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
  // multiSet escribe varias claves en una sola transacción: la cola y los
  // registros no quedan a medias si la app se cierra en medio.
  writeMany: (pairs) => AsyncStorage.multiSet(pairs),
};

/** Repositorio anterior (solo check-ins, sin usuario). Se mantiene por compatibilidad. */
export const entriesRepository = createEntriesRepository(asyncStorageBackend);

// Un almacén por cuenta, reutilizado mientras la app esté abierta.
const stores = new Map();
export function diaryStoreFor(namespace) {
  if (!stores.has(namespace)) stores.set(namespace, createDiaryStore(asyncStorageBackend, namespace));
  return stores.get(namespace);
}

export const diaryApi = createDiaryApi({ baseUrl: API_URL });

/** Preferencias locales pequeñas (idioma, perfil en caché para abrir sin red). */
export const PREF_KEYS = {
  lang: 'raiz.lang.v1',
  profile: 'raiz.profile.v1',
  // { [id de cuenta]: firma } de lo escrito sin sesión que esa cuenta decidió
  // NO adoptar (ver offerAdoption en AppContext).
  adoptDeclined: 'raiz.adoptDeclined.v1',
  // Se completó (o saltó) el onboarding una vez: ver src/lib/onboarding.js
  // (decideSplashRoute) y SplashScreen.js. No depende de la cuenta: es del
  // teléfono, así que sobrevive a cerrar sesión.
  onboarded: 'raiz.onboarded.v1',
  // Categorías elegidas en el paso de enfoque del onboarding (JSON de claves
  // de src/lib/onboarding.js:FOCUS_OPTIONS). Se usa solo para resaltar
  // contenido en ExploreScreen.js — nada crítico si se pierde.
  onboardingFocus: 'raiz.onboardingFocus.v1',
};

export const prefs = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};
