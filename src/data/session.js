import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { ApiError } from './socialCore';
import { socialApi } from './socialApi';

export const SESSION_KEY = 'raiz.session.v1';

/**
 * Sesión contra el API real (login por código de correo institucional).
 *
 * Deliberadamente sin capa de abstracción de "backend" como entriesRepository:
 * a diferencia del almacenamiento local, no hay una versión sin red con la que
 * intercambiarla — el login siempre habla con un servidor.
 */

// Un solo tipo de error para todo el API (ver socialCore.js). Se sigue
// exportando como AuthError porque Login y Perfil lo usan con ese nombre.
const AuthError = ApiError;

async function postJson(path, body) {
  if (!API_URL) {
    throw new AuthError('sin_configurar', 0);
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError('sin_conexion', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AuthError(data.error ?? 'error_desconocido', res.status);
  }
  return data;
}

/** Pide un código nuevo al correo dado. No revela si ya existía uno vigente. */
export async function requestCode(email, lang) {
  await postJson('/auth/request-code', { email, lang });
}

/** Verifica el código y, si es válido, guarda la sesión localmente. */
export async function verifyCode(email, code) {
  const { token } = await postJson('/auth/verify-code', { email, code });
  await AsyncStorage.setItem(SESSION_KEY, token);
  return token;
}

/**
 * Login con correo y contraseña — solo para cuentas de prueba (ver migración
 * password_auth). El login principal sigue siendo el código de un solo uso;
 * esto es la puerta rápida mientras no hay correo configurado para enviarlo.
 */
export async function loginWithPassword(email, password) {
  const { token } = await postJson('/auth/login-password', { email, password });
  await AsyncStorage.setItem(SESSION_KEY, token);
  return token;
}

/** Datos de la sesión activa: correo, nombre visible, rol, fecha de alta. */
export async function getMe(token) {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new AuthError('sesion_invalida', res.status);
  return res.json();
}

/** Cambia el nombre visible. displayName debe tener entre 2 y 40 caracteres. */
export async function updateDisplayName(token, displayName) {
  const res = await fetch(`${API_URL}/auth/profile`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ displayName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new AuthError(data.error ?? 'error_desconocido', res.status);
  }
}

/**
 * Versión del servidor: 2 si tiene /meta, 1 si responde 404, null si no hubo
 * conexión. La guarda el cliente social para degradar lo que v1 no tiene.
 */
export async function getMeta() {
  return socialApi.getMeta();
}

/**
 * Cambio parcial del perfil: cualquier subconjunto de
 * { displayName, avatarEmoji, avatarColor, bio, locale }. Con v1 solo se
 * envía el alias.
 */
export async function updateProfile(token, patch) {
  return socialApi.updateProfile(token, patch);
}

/** Borra la cuenta y todo lo suyo en el servidor, y la sesión local. */
export async function deleteAccount(token) {
  await socialApi.deleteAccount(token);
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getStoredToken() {
  return AsyncStorage.getItem(SESSION_KEY);
}

export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export { AuthError };
