/**
 * Núcleo puro de la red social: armado de rutas y query strings, cliente HTTP
 * con `fetch` inyectable, normalización de respuestas v1/v2 y utilidades sin
 * estado (reacciones optimistas, hilos de comentarios, validación de perfil).
 *
 * No importa NADA de React Native ni de Expo: corre tal cual en Node y se
 * prueba en tests/social*.test.mjs con un fetch simulado. Los módulos
 * community.js, users.js, notifications.js y session.js solo lo atan a
 * API_URL y al fetch global.
 *
 * Contrato: api/API.md (v2). Un servidor v1 no tiene /meta; lo que v1 no
 * tiene se degrada aquí (listas vacías, filtros en el cliente) para que las
 * pantallas nunca muestren un error crudo por una ruta que todavía no existe.
 *
 * Anonimato: la normalización nunca inventa ni conserva datos de autor para
 * algo anónimo — si el servidor manda `author: null` y `author_name: null`,
 * el objeto normalizado tiene `author: null` y nada más que lo ligue.
 */

// ── constantes del contrato ──────────────────────────────────────────────

export const TOPICS = ['general', 'estudios', 'ansiedad', 'relaciones', 'logros', 'autocuidado', 'desahogo'];
export const REACTION_KINDS = ['abrazo', 'fuerza', 'te_entiendo', 'inspira'];
export const REPORT_REASONS = ['self_harm', 'harassment', 'spam', 'personal_info', 'other'];
export const AVATAR_COLORS = ['lilac', 'mint', 'sun', 'peach', 'sky', 'rose'];
export const NOTIFICATION_KINDS = [
  'post_reaction', 'post_comment', 'comment_reply', 'comment_like', 'new_follower',
  'post_approved', 'post_rejected', 'post_hidden', 'comment_approved', 'comment_rejected',
];

export const LIMITS = {
  postBody: 2000,
  commentBody: 1000,
  displayNameMin: 2,
  displayNameMax: 40,
  bio: 160,
  avatarEmojiMax: 8,
  pageSize: 20,
  reportDetail: 500,
};

// ── errores ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** Clave de i18n (src/i18n/social.js) para mostrar un error sin exponer el código crudo. */
export function errorMessageKey(error) {
  const code = error?.code;
  switch (code) {
    case 'sin_conexion': return 'socErrOffline';
    case 'sin_configurar': return 'socErrOffline';
    case 'demasiadas_publicaciones': return 'socErrTooManyPosts';
    case 'demasiados_comentarios': return 'socErrTooManyComments';
    case 'falta_nombre': return 'socErrNeedAlias';
    case 'texto_invalido': return 'socErrText';
    case 'nombre_invalido': return 'socErrName';
    case 'bio_invalida': return 'socErrBio';
    case 'avatar_invalido': return 'socErrAvatar';
    case 'not_found': return 'socErrNotFound';
    case 'no_disponible': return 'socErrUnavailable';
    case 'sesion_invalida':
    case 'sin_sesion': return 'socErrSession';
    case 'tiene_historial_de_moderacion': return 'socErrModHistory';
    default: return 'socErrGeneric';
  }
}

// ── query strings y rutas ────────────────────────────────────────────────

/** `?a=1&b=x` omitiendo undefined, null y ''. Cadena vacía si no queda nada. */
export function buildQuery(params = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

const seg = (v) => encodeURIComponent(String(v));

/**
 * Ruta del feed. `sort=popular` pagina por `offset` (el contrato ignora
 * `before` en ese orden); `recent` pagina por `before`.
 */
export function feedPath({ feed = 'all', topic, sort = 'recent', q, before, offset, limit } = {}) {
  const popular = sort === 'popular';
  return `/posts${buildQuery({
    feed,
    topic: topic || undefined,
    sort,
    q: q?.trim() || undefined,
    before: popular ? undefined : before,
    offset: popular && offset ? offset : undefined,
    limit,
  })}`;
}

// ── normalización ────────────────────────────────────────────────────────

const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
};

export function normalizeAuthor(raw) {
  if (!raw) return null;
  return {
    publicId: raw.public_id ?? raw.publicId ?? null,
    displayName: raw.display_name ?? raw.displayName ?? null,
    avatarEmoji: raw.avatar_emoji ?? raw.avatarEmoji ?? null,
    avatarColor: raw.avatar_color ?? raw.avatarColor ?? null,
  };
}

/**
 * v2 manda `author`; v1 solo `author_name`. En v1 con nombre armamos un autor
 * sin public_id (no navegable). Anónimo en cualquiera → null.
 */
function authorFrom(raw) {
  if (raw.author) return normalizeAuthor(raw.author);
  const name = raw.author_name ?? null;
  return name ? { publicId: null, displayName: name, avatarEmoji: null, avatarColor: null } : null;
}

function heldReasonFrom(raw, isOwn, status) {
  if (!isOwn || status !== 'pending') return null;
  const r = raw.held_reason;
  if (r === 'crisis' || r === 'review' || r === 'reports') return r;
  return 'review'; // v1: todo nace pendiente de revisión humana
}

export function emptyReactionCounts() {
  return { abrazo: 0, fuerza: 0, te_entiendo: 0, inspira: 0 };
}

export function normalizePost(raw) {
  if (!raw) return null;
  const isOwn = !!raw.is_own;
  const status = raw.status ?? 'published';
  const counts = emptyReactionCounts();
  if (raw.reaction_counts && typeof raw.reaction_counts === 'object') {
    for (const k of REACTION_KINDS) counts[k] = toInt(raw.reaction_counts[k]);
  } else {
    counts.abrazo = toInt(raw.reactions);
  }
  const sum = REACTION_KINDS.reduce((s, k) => s + counts[k], 0);
  let myReaction = null;
  if (raw.my_reaction !== undefined) {
    myReaction = REACTION_KINDS.includes(raw.my_reaction) ? raw.my_reaction : null;
  } else if (raw.reacted_by_me) {
    myReaction = 'abrazo';
  }
  const author = authorFrom(raw);
  return {
    id: raw.id,
    body: raw.body ?? '',
    mood: Number.isInteger(raw.mood) && raw.mood >= 0 && raw.mood <= 4 ? raw.mood : null,
    topic: TOPICS.includes(raw.topic) ? raw.topic : null,
    status,
    createdAt: raw.created_at ?? null,
    editedAt: raw.edited_at ?? null,
    author,
    isOwn,
    reactionCounts: counts,
    reactionTotal: sum,
    myReaction,
    commentCount: toInt(raw.comment_count),
    savedByMe: !!raw.saved_by_me,
    heldReason: heldReasonFrom(raw, isOwn, status),
  };
}

export function normalizeComment(raw) {
  if (!raw) return null;
  const isOwn = !!raw.is_own;
  const status = raw.status ?? 'published';
  return {
    id: raw.id,
    postId: raw.post_id ?? null,
    parentId: raw.parent_id ?? null,
    body: raw.body ?? '',
    status,
    createdAt: raw.created_at ?? null,
    author: authorFrom(raw),
    isOwn,
    likes: toInt(raw.likes),
    likedByMe: !!raw.liked_by_me,
    heldReason: heldReasonFrom(raw, isOwn, status),
  };
}

export function normalizeUser(raw) {
  if (!raw) return null;
  return {
    publicId: raw.public_id ?? null,
    displayName: raw.display_name ?? null,
    avatarEmoji: raw.avatar_emoji ?? null,
    avatarColor: raw.avatar_color ?? null,
    bio: raw.bio ?? '',
    memberSince: raw.member_since ?? null,
    postCount: toInt(raw.post_count),
    followers: toInt(raw.followers),
    following: toInt(raw.following),
    followedByMe: !!raw.followed_by_me,
    isMe: !!raw.is_me,
  };
}

export function normalizeNotification(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    kind: raw.kind,
    postId: raw.post_id ?? null,
    commentId: raw.comment_id ?? null,
    reactionKind: REACTION_KINDS.includes(raw.reaction_kind) ? raw.reaction_kind : null,
    actor: normalizeAuthor(raw.actor),
    excerpt: raw.excerpt ?? '',
    createdAt: raw.created_at ?? null,
    read: !!raw.read,
  };
}

/** Acepta el objeto crudo de /auth/me (snake_case) o uno ya normalizado. */
export function normalizeMe(raw) {
  if (!raw) return null;
  return {
    id: raw.id ?? null,
    email: raw.email ?? null,
    displayName: raw.display_name ?? raw.displayName ?? null,
    role: raw.role ?? null,
    locale: raw.locale ?? null,
    createdAt: raw.created_at ?? raw.createdAt ?? null,
    publicId: raw.public_id ?? raw.publicId ?? null,
    avatarEmoji: raw.avatar_emoji ?? raw.avatarEmoji ?? null,
    avatarColor: raw.avatar_color ?? raw.avatarColor ?? null,
    bio: raw.bio ?? '',
  };
}

export function normalizeBlock(raw) {
  return { id: raw.id, createdAt: raw.created_at ?? null, label: raw.label ?? '' };
}

/**
 * Resultado de moderación. v2 lo manda explícito; v1 no lo manda y todo nace
 * 'pending', que para la persona es "lo revisará un moderador".
 */
export function normalizeModeration(data, item) {
  const m = data?.moderation;
  if (m && (m.outcome === 'published' || m.outcome === 'held')) {
    const reason = m.outcome === 'held' ? (m.reason === 'crisis' ? 'crisis' : 'review') : null;
    return { outcome: m.outcome, reason };
  }
  if (item?.status === 'published') return { outcome: 'published', reason: null };
  return { outcome: 'held', reason: 'review' };
}

// ── lógica sin estado para las pantallas ─────────────────────────────────

/** Aplica (o quita, con kind null) mi reacción a un post normalizado. */
export function applyReaction(post, kind) {
  const counts = { ...post.reactionCounts };
  if (post.myReaction) counts[post.myReaction] = Math.max(0, counts[post.myReaction] - 1);
  if (kind) counts[kind] = (counts[kind] ?? 0) + 1;
  const total = REACTION_KINDS.reduce((s, k) => s + counts[k], 0);
  return { ...post, reactionCounts: counts, reactionTotal: total, myReaction: kind ?? null };
}

export function applyCommentLike(comment, liked) {
  if (comment.likedByMe === liked) return comment;
  return { ...comment, likedByMe: liked, likes: Math.max(0, comment.likes + (liked ? 1 : -1)) };
}

/**
 * Agrupa respuestas de un nivel bajo su comentario padre. Una respuesta cuyo
 * padre no está (oculto o borrado) se muestra como de primer nivel.
 */
export function threadComments(comments) {
  const top = [];
  const byId = new Map();
  for (const c of comments) {
    if (!c.parentId) {
      const node = { ...c, replies: [] };
      top.push(node);
      byId.set(c.id, node);
    }
  }
  for (const c of comments) {
    if (!c.parentId) continue;
    const parent = byId.get(c.parentId);
    if (parent) parent.replies.push(c);
    else top.push({ ...c, replies: [] });
  }
  const t = (x) => new Date(x.createdAt ?? 0).getTime();
  top.sort((a, b) => t(a) - t(b));
  for (const n of top) n.replies.sort((a, b) => t(a) - t(b));
  return top;
}

/** Minúsculas y sin tildes, para la búsqueda en el cliente con servidor v1. */
export function foldText(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Mismas reglas que PATCH /auth/profile. Devuelve el código de error o null. */
export function validateProfileDraft({ displayName, avatarEmoji, avatarColor, bio } = {}) {
  if (displayName !== undefined) {
    const n = String(displayName).trim();
    if (n.length < LIMITS.displayNameMin || n.length > LIMITS.displayNameMax) return 'nombre_invalido';
  }
  if (avatarEmoji !== undefined) {
    const e = String(avatarEmoji);
    if (e.length < 1 || e.length > LIMITS.avatarEmojiMax) return 'avatar_invalido';
  }
  if (avatarColor !== undefined && !AVATAR_COLORS.includes(avatarColor)) return 'avatar_invalido';
  if (bio !== undefined && String(bio).length > LIMITS.bio) return 'bio_invalida';
  return null;
}

/** Actualiza en una lista el post con el mismo id (o lo quita si next es null). */
export function replaceInList(list, id, next) {
  if (next === null) return list.filter(p => p.id !== id);
  return list.map(p => (p.id === id ? next : p));
}

/** Une una página nueva a la lista sin duplicar ids. */
export function mergePage(list, page) {
  const seen = new Set(list.map(p => p.id));
  return [...list, ...page.filter(p => !seen.has(p.id))];
}

// ── cliente ──────────────────────────────────────────────────────────────

const isUnavailable = (e) => e instanceof ApiError && (e.status === 404 || e.code === 'no_disponible');

/**
 * Crea el cliente del API social. `fetchImpl` se inyecta para poder probarlo
 * en Node. Guarda la versión del servidor que descubrió con getMeta().
 */
export function createSocialApi({ baseUrl, fetchImpl } = {}) {
  let version = null;

  async function request(token, path, { method = 'GET', body, auth = true } = {}) {
    if (!baseUrl) throw new ApiError('sin_configurar', 0);
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (auth && token) headers.authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiError('sin_conexion', 0);
    }
    let data = null;
    if (res.status !== 204) {
      try { data = await res.json(); } catch { data = null; }
    }
    if (!res.ok) {
      const code = data?.error ?? (res.status === 404 ? 'not_found' : 'error_desconocido');
      throw new ApiError(code, res.status);
    }
    return data ?? {};
  }

  const api = {
    request,
    get apiVersion() { return version; },
    setApiVersion(v) { version = v === 1 || v === 2 ? v : version; },

    // ── descubrimiento ──
    async getMeta() {
      try {
        const data = await request(null, '/meta', { auth: false });
        version = toInt(data.api_version, 2) >= 2 ? 2 : 1;
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) version = 1;
        else return null; // sin conexión: no sabemos todavía
      }
      return version;
    },

    // ── cuenta ──
    async getMe(token) {
      return normalizeMe(await request(token, '/auth/me'));
    },
    /** Parcial. Con servidor v1 solo se manda el alias (lo único que v1 entiende). */
    async updateProfile(token, patch) {
      const body = {};
      for (const k of ['displayName', 'avatarEmoji', 'avatarColor', 'bio', 'locale']) {
        if (patch?.[k] !== undefined) body[k] = k === 'displayName' ? String(patch[k]).trim() : patch[k];
      }
      if (version === 1) {
        if (body.displayName === undefined) return { ok: true, skipped: true };
        await request(token, '/auth/profile', { method: 'PATCH', body: { displayName: body.displayName } });
        return { ok: true };
      }
      await request(token, '/auth/profile', { method: 'PATCH', body });
      return { ok: true };
    },
    async deleteAccount(token) {
      if (version === 1) throw new ApiError('no_disponible', 404);
      await request(token, '/auth/account', { method: 'DELETE' });
      return { ok: true };
    },

    // ── feed ──
    async listPosts(token, opts = {}) {
      const limit = opts.limit ?? LIMITS.pageSize;
      if (version === 1) {
        if (opts.feed === 'following') return { posts: [], next: null };
        const data = await request(token, '/posts');
        let posts = (data.posts ?? []).map(normalizePost);
        const q = foldText(opts.q?.trim());
        if (q) posts = posts.filter(p => foldText(p.body).includes(q));
        if (opts.sort === 'popular') {
          posts = [...posts].sort((a, b) => (b.reactionTotal + b.commentCount) - (a.reactionTotal + a.commentCount));
        }
        return { posts, next: null };
      }
      const data = await request(token, feedPath({ ...opts, limit }));
      const posts = (data.posts ?? []).map(normalizePost);
      let next = null;
      if (opts.sort === 'popular') {
        next = posts.length >= limit ? (opts.offset ?? 0) + posts.length : null;
      } else {
        next = data.next_before ?? null;
      }
      return { posts, next };
    },
    async getPost(token, id) {
      try {
        const data = await request(token, `/posts/${seg(id)}`);
        return normalizePost(data.post);
      } catch (e) {
        // v1 no tiene GET /posts/:id: lo buscamos en el feed.
        if (version !== 2 && isUnavailable(e)) {
          const data = await request(token, '/posts');
          const found = (data.posts ?? []).find(p => String(p.id) === String(id));
          if (found) return normalizePost(found);
        }
        throw e;
      }
    },
    async createPost(token, { body, mood, topic, isAnonymous = true }) {
      const payload = { body, isAnonymous };
      if (mood !== undefined && mood !== null) payload.mood = mood;
      if (topic && version !== 1) payload.topic = topic;
      const data = await request(token, '/posts', { method: 'POST', body: payload });
      const post = normalizePost(data.post);
      return { post, moderation: normalizeModeration(data, data.post) };
    },
    async updatePost(token, id, { body, mood, topic }) {
      if (version === 1) throw new ApiError('no_disponible', 404);
      const payload = { body };
      if (mood !== undefined) payload.mood = mood;
      if (topic !== undefined) payload.topic = topic;
      const data = await request(token, `/posts/${seg(id)}`, { method: 'PATCH', body: payload });
      const post = normalizePost(data.post);
      return { post, moderation: normalizeModeration(data, data.post) };
    },
    async deletePost(token, id) {
      await request(token, `/posts/${seg(id)}`, { method: 'DELETE' });
    },
    async react(token, id, kind = 'abrazo') {
      await request(token, `/posts/${seg(id)}/react`, { method: 'POST', body: { kind } });
    },
    async unreact(token, id) {
      await request(token, `/posts/${seg(id)}/react`, { method: 'DELETE' });
    },
    async savePost(token, id) {
      await request(token, `/posts/${seg(id)}/save`, { method: 'POST' });
    },
    async unsavePost(token, id) {
      await request(token, `/posts/${seg(id)}/save`, { method: 'DELETE' });
    },
    async reportPost(token, id, reason, detail) {
      const body = { reason };
      if (detail?.trim()) body.detail = detail.trim().slice(0, LIMITS.reportDetail);
      await request(token, `/posts/${seg(id)}/report`, { method: 'POST', body });
    },
    async blockPostAuthor(token, id) {
      await request(token, `/posts/${seg(id)}/block-author`, { method: 'POST' });
    },

    // ── comentarios ──
    async listComments(token, postId) {
      const data = await request(token, `/posts/${seg(postId)}/comments`);
      return (data.comments ?? []).map(normalizeComment);
    },
    async createComment(token, postId, { body, isAnonymous = true, parentId }) {
      const payload = { body, isAnonymous };
      if (parentId && version !== 1) payload.parentId = parentId;
      const data = await request(token, `/posts/${seg(postId)}/comments`, { method: 'POST', body: payload });
      const comment = normalizeComment(data.comment);
      return { comment, moderation: normalizeModeration(data, data.comment) };
    },
    async deleteComment(token, id) {
      await request(token, `/posts/comments/${seg(id)}`, { method: 'DELETE' });
    },
    async likeComment(token, id) {
      await request(token, `/posts/comments/${seg(id)}/like`, { method: 'POST' });
    },
    async unlikeComment(token, id) {
      await request(token, `/posts/comments/${seg(id)}/like`, { method: 'DELETE' });
    },
    async reportComment(token, id, reason, detail) {
      const body = { reason };
      if (detail?.trim()) body.detail = detail.trim().slice(0, LIMITS.reportDetail);
      await request(token, `/posts/comments/${seg(id)}/report`, { method: 'POST', body });
    },
    async blockCommentAuthor(token, id) {
      await request(token, `/posts/comments/${seg(id)}/block-author`, { method: 'POST' });
    },

    // ── personas ──
    async getUser(token, publicId) {
      const data = await request(token, `/users/${seg(publicId)}`);
      return normalizeUser(data.user);
    },
    async listUserPosts(token, publicId, { before } = {}) {
      const data = await request(token, `/users/${seg(publicId)}/posts${buildQuery({ before })}`);
      return { posts: (data.posts ?? []).map(normalizePost), next: data.next_before ?? null };
    },
    async follow(token, publicId) {
      await request(token, `/users/${seg(publicId)}/follow`, { method: 'POST' });
    },
    async unfollow(token, publicId) {
      await request(token, `/users/${seg(publicId)}/follow`, { method: 'DELETE' });
    },
    async blockUser(token, publicId) {
      await request(token, `/users/${seg(publicId)}/block`, { method: 'POST' });
    },
    async listBlocks(token) {
      try {
        const data = await request(token, '/me/blocks');
        return (data.blocks ?? []).map(normalizeBlock);
      } catch (e) {
        if (isUnavailable(e)) return [];
        throw e;
      }
    },
    async unblock(token, id) {
      await request(token, `/me/blocks/${seg(id)}`, { method: 'DELETE' });
    },

    // ── lo mío ──
    async listMyPosts(token, { before } = {}) {
      try {
        if (version === 1) throw new ApiError('no_disponible', 404);
        const data = await request(token, `/me/posts${buildQuery({ before })}`);
        return { posts: (data.posts ?? []).map(normalizePost), next: data.next_before ?? null };
      } catch (e) {
        if (!isUnavailable(e)) throw e;
        const data = await request(token, '/posts');
        return { posts: (data.posts ?? []).map(normalizePost).filter(p => p.isOwn), next: null };
      }
    },
    async listSaved(token, { before } = {}) {
      try {
        if (version === 1) return { posts: [], next: null };
        const data = await request(token, `/me/saved${buildQuery({ before })}`);
        return { posts: (data.posts ?? []).map(normalizePost), next: data.next_before ?? null };
      } catch (e) {
        if (isUnavailable(e)) return { posts: [], next: null };
        throw e;
      }
    },

    // ── notificaciones ──
    async listNotifications(token, { before } = {}) {
      try {
        if (version === 1) return { notifications: [], unread: 0, next: null };
        const data = await request(token, `/notifications${buildQuery({ before })}`);
        return {
          notifications: (data.notifications ?? []).map(normalizeNotification),
          unread: toInt(data.unread),
          next: data.next_before ?? null,
        };
      } catch (e) {
        if (isUnavailable(e)) return { notifications: [], unread: 0, next: null };
        throw e;
      }
    },
    async unreadCount(token) {
      try {
        if (version === 1) return 0;
        const data = await request(token, '/notifications/unread-count');
        return toInt(data.unread);
      } catch (e) {
        if (isUnavailable(e)) return 0;
        throw e;
      }
    },
    async markRead(token, ids) {
      try {
        if (version === 1) return;
        await request(token, '/notifications/read', { method: 'POST', body: ids?.length ? { ids } : {} });
      } catch (e) {
        if (!isUnavailable(e)) throw e;
      }
    },
  };
  return api;
}
