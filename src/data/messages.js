import { socialApi } from './socialApi';

/**
 * Mensajes privados, contra el API real (contrato en api/API.md § Mensajes).
 * Con un servidor v1 (sin /messages) todo se degrada a vacío/deshabilitado
 * en vez de fallar — ver isUnavailable en socialCore.js.
 */

export const getMessageSettings = (token) => socialApi.getMessageSettings(token);
export const setMessageEnabled = (token, enabled) => socialApi.setMessageEnabled(token, enabled);
export const unreadMessages = (token) => socialApi.unreadMessages(token);

export const listConversations = (token, opts) => socialApi.listConversations(token, opts);
export const listMessageRequests = (token) => socialApi.listMessageRequests(token);
export const getConversation = (token, id) => socialApi.getConversation(token, id);
export const listMessages = (token, conversationId, opts) => socialApi.listMessages(token, conversationId, opts);

/** Abre (o reabre) una conversación con `publicId` y manda `body` — es la solicitud. */
export const startConversation = (token, draft) => socialApi.startConversation(token, draft);
export const sendMessage = (token, conversationId, body) => socialApi.sendMessage(token, conversationId, body);

export const acceptConversation = (token, id) => socialApi.acceptConversation(token, id);
export const rejectConversation = (token, id) => socialApi.rejectConversation(token, id);
export const markConversationRead = (token, id) => socialApi.markConversationRead(token, id);

export const reportMessage = (token, messageId, reason, detail) => socialApi.reportMessage(token, messageId, reason, detail);
