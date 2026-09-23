import { API_URL } from '../config';
import { createSocialApi } from './socialCore';

/**
 * Instancia única del cliente social atada a API_URL y al fetch global.
 * Toda la lógica vive en socialCore.js (puro y probado); esto solo la conecta.
 * Es única para que la versión del servidor descubierta con getMeta() valga
 * para todas las pantallas.
 */
export const socialApi = createSocialApi({
  baseUrl: API_URL,
  fetchImpl: (url, opts) => fetch(url, opts),
});
