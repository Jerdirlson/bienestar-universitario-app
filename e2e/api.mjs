// Llamadas directas al API (api/API.md), para sembrar o verificar cosas que
// serían lentas de hacer por la interfaz (publicar 45 posts para paginar,
// por ejemplo) o para comprobar el estado del servidor sin pasar por la UI.
export const API_URL = process.env.E2E_API_URL || 'http://localhost:3000';

export async function apiLogin(email, password) {
  const r = await fetch(`${API_URL}/auth/login-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`login falló para ${email}: ${r.status} ${JSON.stringify(body)}`);
  return body.token;
}

// Falla ruidoso ante cualquier respuesta que no sea 2xx: una siembra que el
// API rechaza en silencio (un tipo de reacción inválido, publicar con nombre
// sin tenerlo) se veía después como un timeout confuso en otra parte de la
// prueba. Quien espera un error a propósito pasa { allowError: true }.
export async function api(method, path, token, body, { allowError = false } = {}) {
  const r = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok && !allowError) {
    throw new Error(`${method} ${path} → ${r.status} ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  }
  return { status: r.status, body: json };
}

export async function unreadCount(token) {
  const r = await api('GET', '/notifications/unread-count', token);
  return r.body.unread;
}
