import { API_URL } from '../config';
import { AuthError } from './session';

/**
 * Recursos curados de la pestaña Explorar. Viven en la base
 * (explore_resources), no hardcodeados en el bundle — así el panel de
 * administración los puede editar sin un despliegue nuevo de la app.
 *
 * Los artículos propios y los ejercicios guiados, en cambio, van en el
 * bundle (src/data/wellnessContent.js, src/data/breathing.js): funcionan sin
 * conexión y sus fuentes se revisan en el código.
 */
export async function listExploreResources(token) {
  if (!API_URL) throw new AuthError('sin_configurar', 0);
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
  return Array.isArray(data.resources) ? data.resources : [];
}
