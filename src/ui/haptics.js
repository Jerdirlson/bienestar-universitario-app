// Envoltorio de expo-haptics (§5 del sistema de diseño): en web la librería
// no tiene nada que vibrar (ni existe el motor), y en un teléfono real la
// llamada puede fallar (modo silencioso raro, permisos, el hardware no lo
// soporta) — la háptica es un extra sensorial, nunca debe tumbar la acción
// que la disparó (guardar un check-in, reaccionar a un post...). Por eso cada
// función se traga cualquier error y no hace nada en web.
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isWeb = Platform.OS === 'web';

async function safe(fn) {
  if (isWeb) return;
  try {
    await fn();
  } catch {
    // silencioso a propósito: ver comentario de arriba.
  }
}

// Selección: al elegir ánimo, chip o segmento (§5).
export const selection = () => safe(() => Haptics.selectionAsync());
// Impacto leve: al reaccionar a un post, tocar un botón (§5).
export const impactLight = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const impactMedium = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
// Éxito: al guardar un check-in o publicar (§5).
export const notifySuccess = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const notifyError = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

export default { selection, impactLight, impactMedium, notifySuccess, notifyError };
