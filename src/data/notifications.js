import { socialApi } from './socialApi';

/**
 * Notificaciones (ver api/API.md). Con un servidor v1 devuelven listas
 * vacías y conteo 0 en vez de fallar.
 */
export const listNotifications = (token, opts) => socialApi.listNotifications(token, opts);
export const getUnreadCount = (token) => socialApi.unreadCount(token);
/** Sin ids marca todas como leídas. */
export const markNotificationsRead = (token, ids) => socialApi.markRead(token, ids);
