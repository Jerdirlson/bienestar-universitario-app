import { API_URL } from '../config';
import { AuthError } from './session';

/**
 * Comunidad anónima, contra el API real (ver api/src/posts.js).
 *
 * Nada de esto es local ni tiene versión sin red: a diferencia del diario,
 * publicar es inherentemente un acto compartido. Todas las funciones
 * requieren el token de sesión.
 */

async function call(token, path, opts = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...opts,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...opts.headers },
    });
  } catch {
    throw new AuthError('sin_conexion', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AuthError(data.error ?? 'error_desconocido', res.status);
  return data;
}

/** Publicados por cualquiera + los propios en cualquier estado (lo decide la base, no esto). */
export async function listPosts(token) {
  const { posts } = await call(token, '/posts');
  return posts;
}

/**
 * Nace 'pending' — no aparece para nadie más hasta que un moderador lo
 * aprueba. isAnonymous en true (default) no manda nombre; en false, el API
 * firma con el display_name ya guardado en el perfil — si no hay uno
 * puesto, devuelve el error 'falta_nombre'.
 */
export async function createPost(token, { body, mood, isAnonymous = true }) {
  const { post } = await call(token, '/posts', { method: 'POST', body: JSON.stringify({ body, mood, isAnonymous }) });
  return post;
}

export async function deletePost(token, id) {
  await call(token, `/posts/${id}`, { method: 'DELETE' });
}

export async function reactToPost(token, id) {
  await call(token, `/posts/${id}/react`, { method: 'POST' });
}

export async function unreactToPost(token, id) {
  await call(token, `/posts/${id}/react`, { method: 'DELETE' });
}

export async function reportPost(token, id, reason, detail) {
  await call(token, `/posts/${id}/report`, { method: 'POST', body: JSON.stringify({ reason, detail }) });
}

// ── comentarios ──────────────────────────────────────────────────────────
// Moderar (aprobar/rechazar) NO vive acá — es exclusivo del panel de
// administración (admin/, contra /admin/*). La app móvil no tiene ningún
// camino para hacerlo, ni oculto.

export async function listComments(token, postId) {
  const { comments } = await call(token, `/posts/${postId}/comments`);
  return comments;
}

export async function createComment(token, postId, { body, isAnonymous = true }) {
  const { comment } = await call(token, `/posts/${postId}/comments`, {
    method: 'POST', body: JSON.stringify({ body, isAnonymous }),
  });
  return comment;
}

export async function deleteComment(token, id) {
  await call(token, `/posts/comments/${id}`, { method: 'DELETE' });
}
