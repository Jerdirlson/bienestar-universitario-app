import { Alert, Platform } from 'react-native';
import { runWebAlert } from '../lib/webAlert';

/**
 * Alert.alert que también funciona en la versión web.
 *
 * En el teléfono es exactamente Alert.alert. En web, react-native-web no
 * implementa Alert: la llamada no hacía nada, así que cada confirmación
 * ("¿borrar?", "¿bloquear?", "¿cerrar sesión?") se quedaba sin respuesta y la
 * acción nunca ocurría — y el aviso del SOS con el número para marcar a mano
 * no se veía. En web se traduce a los diálogos del navegador (ver
 * src/lib/webAlert.js).
 */
export function showAlert(title, message, buttons, options) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    Alert.alert(title, message, buttons, options);
    return;
  }
  runWebAlert(title, message, buttons, {
    alert: (text) => window.alert(text),
    confirm: (text) => window.confirm(text),
  });
}
