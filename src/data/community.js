import { socialApi } from './socialApi';

/**
 * Comunidad, contra el API real (contrato en api/API.md, sección "Comunidad").
 *
 * Nada de esto es local ni tiene versión sin red: a diferencia del diario,
 * publicar es inherentemente un acto compartido. Todas las funciones reciben
 * el token de sesión y devuelven objetos normalizados en camelCase (ver
 * normalizePost / normalizeComment en socialCore.js), iguales con servidor
 * v1 o v2.
 *
 * Moderar (aprobar/rechazar) NO vive aquí — es exclusivo del panel de
 * administración (admin-web/, contra /admin/*). La app móvil no tiene ningún
 * camino para hacerlo, ni oculto.
 */

// ── publicaciones ──
/** → { posts, next } — `next` es el cursor de la página siguiente o null. */
export const listPosts = (token, opts) => socialApi.listPosts(token, opts);
export const getPost = (token, id) => socialApi.getPost(token, id);
/** → { post, moderation: { outcome: 'published'|'held', reason: null|'review'|'crisis' } } */
export const createPost = (token, draft) => socialApi.createPost(token, draft);
export const updatePost = (token, id, draft) => socialApi.updatePost(token, id, draft);
export const deletePost = (token, id) => socialApi.deletePost(token, id);

export const reactToPost = (token, id, kind) => socialApi.react(token, id, kind);
export const unreactToPost = (token, id) => socialApi.unreact(token, id);
export const savePost = (token, id) => socialApi.savePost(token, id);
export const unsavePost = (token, id) => socialApi.unsavePost(token, id);
export const reportPost = (token, id, reason, detail) => socialApi.reportPost(token, id, reason, detail);
export const blockPostAuthor = (token, id) => socialApi.blockPostAuthor(token, id);

// ── lo mío ──
export const listMyPosts = (token, opts) => socialApi.listMyPosts(token, opts);
export const listSavedPosts = (token, opts) => socialApi.listSaved(token, opts);

// ── comentarios ──
export const listComments = (token, postId) => socialApi.listComments(token, postId);
/** → { comment, moderation } */
export const createComment = (token, postId, draft) => socialApi.createComment(token, postId, draft);
export const deleteComment = (token, id) => socialApi.deleteComment(token, id);
export const likeComment = (token, id) => socialApi.likeComment(token, id);
export const unlikeComment = (token, id) => socialApi.unlikeComment(token, id);
export const reportComment = (token, id, reason, detail) => socialApi.reportComment(token, id, reason, detail);
export const blockCommentAuthor = (token, id) => socialApi.blockCommentAuthor(token, id);
