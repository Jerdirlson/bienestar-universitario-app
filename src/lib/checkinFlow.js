/**
 * A dónde vuelve el check-in al terminar o al cerrarse.
 *
 * Las pantallas del check-in viven en la pila de Inicio. Abiertas desde el
 * calendario de Progreso, al terminar hacían popToTop() y la persona quedaba
 * en Inicio, no donde empezó. Ahora quien abre el check-in puede pasar
 * `returnTo` (la pestaña de origen) y cada paso lo lleva al siguiente.
 *
 * Puro: `navigation` solo necesita popToTop() y navigate(); se prueba en Node
 * (tests/checkinFlow.test.mjs).
 */

// Pestañas a las que se puede volver. Una lista cerrada: un parámetro de ruta
// no debería poder mandar a cualquier pantalla.
export const RETURN_TABS = ['insights'];

/** Parámetros del paso siguiente, conservando a dónde volver. */
export function withReturn(params, returnTo) {
  return RETURN_TABS.includes(returnTo) ? { ...(params ?? {}), returnTo } : params;
}

/** Sale del check-in: vacía la pila de Inicio y, si empezó en otra pestaña, vuelve a ella. */
export function exitCheckin(navigation, returnTo) {
  navigation.popToTop();
  if (RETURN_TABS.includes(returnTo)) navigation.navigate(returnTo);
}
