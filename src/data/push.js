import { socialApi } from './socialApi';

/**
 * Notificaciones push, contra el API real (contrato en api/API.md § Tiempo
 * real y notificaciones push). Con un servidor v1 se degrada a
 * deshabilitado/no-op — ver socialCore.js.
 */

export const getPushSettings = (token) => socialApi.getPushSettings(token);
export const setPushEnabled = (token, enabled) => socialApi.setPushEnabled(token, enabled);

/** Nunca falla ruidoso: registrar/quitar el token es un efecto secundario del login. */
export const registerPushToken = (token, pushToken) => socialApi.registerPushToken(token, pushToken);
export const unregisterPushToken = (token, pushToken) => socialApi.unregisterPushToken(token, pushToken);
