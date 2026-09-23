import { socialApi } from './socialApi';

/**
 * Perfiles públicos, seguimiento y bloqueos (ver api/API.md, "Personas" y
 * "Bloqueos"). Solo tienen perfil público quienes eligieron un alias: nada de
 * lo anónimo pasa por aquí.
 */
export const getUser = (token, publicId) => socialApi.getUser(token, publicId);
export const listUserPosts = (token, publicId, opts) => socialApi.listUserPosts(token, publicId, opts);
export const followUser = (token, publicId) => socialApi.follow(token, publicId);
export const unfollowUser = (token, publicId) => socialApi.unfollow(token, publicId);
export const blockUser = (token, publicId) => socialApi.blockUser(token, publicId);
export const listBlocks = (token) => socialApi.listBlocks(token);
export const unblock = (token, blockId) => socialApi.unblock(token, blockId);
