import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * true mientras el teclado está visible.
 *
 * Por qué existe: `app.json` tiene `android.edgeToEdgeEnabled: true`, y con
 * eso Android deja de redimensionar la ventana al abrir el teclado. Los
 * botones flotantes posicionados "absolute" al fondo de la pantalla (el FAB
 * de SOS en Comunidad y Explorar, el de "nueva entrada" del diario) no se
 * mueven con un `KeyboardAvoidingView` — este padding no los alcanza, porque
 * "absolute" se posiciona contra el borde del contenedor, no contra su caja
 * de contenido — así que se quedan flotando encima del teclado. Se ocultan
 * mientras se escribe y vuelven en cuanto el teclado se cierra.
 *
 * iOS emite `keyboardWillShow/Hide` (antes de que la animación empiece);
 * Android solo tiene los `did`.
 */
export default function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, () => setVisible(true));
    const onHide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);
  return visible;
}
