import { API_URL } from '../config';
import { AuthError } from './session';

/**
 * Contenido de la pestaña Explorar. Vive en la base (explore_resources), no
 * hardcodeado en el bundle — así el panel de administración lo puede editar
 * sin un despliegue nuevo de la app.
 */
export async function listExploreResources(token) {
  let res;
  try {
    res = await fetch(`${API_URL}/explore`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AuthError('sin_conexion', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AuthError(data.error ?? 'error_desconocido', res.status);
  return data.resources;
}
