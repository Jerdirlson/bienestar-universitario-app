import { Platform } from 'react-native';

/**
 * Notificaciones push (Expo), para cuando la app está cerrada.
 *
 * Todo aquí es "mejor esfuerzo": en Expo Go (que en Android ya no soporta
 * push remoto), en web, en un simulador, o ante cualquier error, no hace
 * nada y no muestra nada — registrar el token es un efecto secundario del
 * login, nunca algo que deba ensuciarlo con un error que la persona no puede
 * resolver. `expo-notifications`/`expo-device` se importan de forma
 * perezosa (dentro de las funciones) para que este archivo se pueda importar
 * sin problema en web, donde el módulo nativo no existe.
 */

let cachedProjectId;
function projectId() {
  if (cachedProjectId !== undefined) return cachedProjectId;
  try {
    // eslint-disable-next-line global-require
    const Constants = require('expo-constants').default;
    cachedProjectId = Constants?.expoConfig?.extra?.eas?.projectId ?? null;
  } catch {
    cachedProjectId = null;
  }
  return cachedProjectId;
}

/** ¿Tiene sentido intentar push en este entorno? Nunca lanza. */
export function canUsePush() {
  try {
    if (Platform.OS === 'web') return false;
    // eslint-disable-next-line global-require
    const Constants = require('expo-constants').default;
    if (Constants?.appOwnership === 'expo') return false; // Expo Go
    // eslint-disable-next-line global-require
    const Device = require('expo-device');
    if (Device?.isDevice === false) return false; // simulador/emulador
    return !!projectId();
  } catch {
    return false;
  }
}

/** true si ya se decidió el permiso (concedido o negado), sin pedirlo. */
export async function hasAskedPermission() {
  try {
    if (!canUsePush()) return true; // nada que preguntar
    // eslint-disable-next-line global-require
    const Notifications = require('expo-notifications');
    const { status } = await Notifications.getPermissionsAsync();
    return status !== 'undetermined';
  } catch {
    return true;
  }
}

/**
 * Pide el permiso del sistema (asume que ya se mostró la explicación previa
 * — ver socPushPermissionTitle/Body) y, si se concede, devuelve el Expo push
 * token. null en cualquier otro caso (negado, sin capacidad, o error).
 */
export async function registerForPush() {
  try {
    if (!canUsePush()) return null;
    // eslint-disable-next-line global-require
    const Notifications = require('expo-notifications');

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted' && existing.canAskAgain !== false) {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Qué pantalla abrir al tocar un push, a partir de `data` (ver
 * api/src/push.js: { kind, conversationId }). Devuelve { screen, params } o
 * null si no hay nada especial que hacer (se abre la app y ya).
 */
export function routeForPushData(data) {
  const kind = data?.kind;
  if (!kind) return null;
  if (kind === 'moderation_alert') return { openPanel: true };
  if (kind === 'message_request' || kind === 'new_message') {
    return data.conversationId ? { screen: 'Chat', params: { conversationId: data.conversationId } } : { screen: 'Messages' };
  }
  return { screen: 'Notifications' };
}
