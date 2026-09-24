/**
 * Reglas de "¿de quién es este diario?" cuando en el mismo teléfono entran
 * cuentas distintas. Puro (sin React Native) para probarlo en Node:
 * tests/accountSwitch.test.mjs.
 *
 * El riesgo que cierran: el diario de una cuenta subido con el token de otra.
 * Pasaba si el perfil en caché (raiz.profile.v1) era de A y el token guardado
 * de B — p. ej. A perdió la sesión (401), B entró y la app se cerró antes de
 * que /auth/me respondiera. Al arrancar, la app creía que el token era de A:
 * subía lo pendiente de A a la cuenta de B y bajaba el diario de B al espacio
 * de A.
 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64url → texto UTF-8, sin depender de atob ni de Buffer. null si no es válido. */
function decodeBase64Url(input) {
  const s = String(input).replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  try {
    // Bytes UTF-8 → texto: escape percent + decodeURIComponent.
    return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join(''));
  } catch {
    return null;
  }
}

/**
 * `sub` del JWT (el id de la cuenta), leído SIN verificar la firma. No sirve
 * para autenticar a nadie — eso lo hace el servidor —; solo para saber si el
 * perfil en caché corresponde al token guardado. null si no se puede leer.
 */
export function tokenSubject(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const json = decodeBase64Url(parts[1]);
  if (!json) return null;
  try {
    const payload = JSON.parse(json);
    return typeof payload?.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Al arrancar: el perfil en caché solo vale si es del dueño del token. Si no
 * coincide (o no se puede saber), se arranca en el espacio sin sesión hasta
 * que /auth/me diga de quién es el token.
 */
export function trustedCachedProfile(token, cached) {
  if (!token || !cached?.id) return null;
  return tokenSubject(token) === cached.id ? cached : null;
}

/**
 * Guarda el token de un login nuevo y OLVIDA el perfil en caché: ese perfil
 * era de la sesión anterior (quizá de otra persona). `storage` tiene la forma
 * de AsyncStorage (setItem / removeItem).
 */
export async function persistNewSession(storage, { sessionKey, profileKey }, token) {
  await storage.removeItem(profileKey);
  await storage.setItem(sessionKey, token);
}

/**
 * ¿Hay que preguntar si lo escrito sin sesión pasa a esta cuenta?
 *
 * `guest` es el snapshot del espacio sin sesión; `declined` lo que se guardó
 * cuando alguien dijo "no" ({ [accountId]: firma }). Si la persona ya dijo
 * que no a ESTE mismo contenido, no se vuelve a preguntar en cada arranque;
 * si el contenido cambió (se escribió algo más sin sesión), sí.
 */
export function adoptionPrompt(guest, declined, accountId) {
  const entries = guest?.entries ?? [];
  const journal = guest?.journal ?? [];
  const count = entries.length + journal.length;
  if (count === 0 || !accountId) return { ask: false, count: 0, signature: null };
  const latest = [...entries, ...journal]
    .map((r) => r.updatedAt ?? r.createdAt ?? '')
    .sort()
    .pop();
  const signature = `${count}:${latest}`;
  return { ask: declined?.[accountId] !== signature, count, signature };
}
