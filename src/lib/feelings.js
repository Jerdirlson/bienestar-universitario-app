/**
 * Orden de las emociones del check-in según el ánimo elegido.
 *
 * Con un ánimo bajo (0–2: muy mal, mal, neutral) aparecen primero las de un
 * día difícil (`hard: true` en i18n); con uno bueno, primero las positivas.
 * Solo cambia el orden: todas siguen disponibles, y lo que se guarda es la
 * clave, así que el histórico no depende de esto.
 */
export function orderFeelings(items, mood) {
  const list = Array.isArray(items) ? items : [];
  const hard = list.filter((i) => i.hard);
  const rest = list.filter((i) => !i.hard);
  return Number.isInteger(mood) && mood <= 2 ? [...hard, ...rest] : [...rest, ...hard];
}
