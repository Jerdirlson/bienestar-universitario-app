import { useEffect, useRef } from 'react';
import { Animated, Keyboard, Platform } from 'react-native';

/**
 * `Animated.Value` con el alto actual del teclado (0 cuando está oculto).
 *
 * Por qué existe: `app.json` tiene `android.edgeToEdgeEnabled: true`, así que
 * en Android el sistema ya no redimensiona la ventana al abrir el teclado.
 * Los botones flotantes con `position: 'absolute'` (el FAB de SOS en
 * Comunidad y Explorar, "nueva entrada" en el diario) no se mueven con un
 * `KeyboardAvoidingView` — el padding que agrega no los alcanza, porque
 * "absolute" se posiciona contra el borde del contenedor, no contra su caja
 * de contenido — así que quedan tapados por el teclado. En vez de ocultarlos
 * (el FAB de SOS no se puede: "El SOS siempre funciona", ver CLAUDE.md), se
 * suben por encima del teclado con un `transform: translateY` animado.
 *
 * iOS emite `keyboardWillShow/Hide` (antes de que la animación empiece, con
 * `duration` propia); Android solo tiene los `did`, así que se anima con una
 * duración fija corta.
 */
export default function useKeyboardHeight() {
  const height = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(height, {
        toValue: e?.endCoordinates?.height ?? 0,
        duration: Platform.OS === 'ios' ? (e?.duration || 220) : 160,
        useNativeDriver: true,
      }).start();
    });
    const onHide = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(height, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e?.duration || 200) : 160,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [height]);
  return height;
}
