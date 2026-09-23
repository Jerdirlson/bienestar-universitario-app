/**
 * Traduce una llamada de Alert.alert(title, message, buttons) a los diálogos
 * del navegador (window.alert / window.confirm). Puro: los diálogos se
 * inyectan, así se prueba en Node. Lo usa src/components/dialogs.js en web.
 *
 *   - sin botones o solo con "cancelar" → alert y luego el onPress de cancelar
 *   - con una sola acción y sin cancelar → alert y luego esa acción
 *   - con cancelar + una acción          → confirm; Aceptar ejecuta la acción
 *   - con varias acciones                → un confirm por acción, en orden,
 *                                          hasta que se acepte una
 *
 * Devuelve el botón que se ejecutó (o null).
 */
export function runWebAlert(title, message, buttons, { alert, confirm }) {
  const text = [title, message].filter(Boolean).join('\n\n');
  const list = Array.isArray(buttons) ? buttons.filter(Boolean) : [];
  const cancel = list.find((b) => b.style === 'cancel') ?? null;
  const actions = list.filter((b) => b !== cancel);

  if (actions.length === 0) {
    alert(text);
    cancel?.onPress?.();
    return cancel;
  }
  if (actions.length === 1 && !cancel) {
    alert(text);
    actions[0].onPress?.();
    return actions[0];
  }
  for (const action of actions) {
    const prompt = actions.length === 1 ? text : `${text}\n\n→ ${action.text}`;
    if (confirm(prompt)) {
      action.onPress?.();
      return action;
    }
  }
  cancel?.onPress?.();
  return cancel;
}
