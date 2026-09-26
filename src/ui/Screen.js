import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardScreen from '../components/KeyboardScreen';
import { COLORS } from '../theme';

/**
 * Contenedor base de pantalla (§5 del sistema de diseño).
 *
 *  - `variant`: 'grouped' (fondo gris `bg`, para listas/tarjetas — es el
 *    valor por defecto porque la mayoría de pantallas de la app son de
 *    listas) o 'plain' (fondo blanco `bgPlain`, para lectura/edición).
 *  - `edges`: qué bordes de área segura aplica como padding (por defecto,
 *    los cuatro). Pantallas que ya ponen su propia barra superior pueden
 *    pasar `edges={['bottom']}` para no duplicar el espacio del notch.
 *  - `keyboard`: reutiliza `KeyboardScreen` (§8, teclado): en iOS/Android
 *    compensa el teclado con el mismo comportamiento ya probado en el resto
 *    de la app; en web no hace nada (`KeyboardAvoidingView` ahí entra en un
 *    bucle de medir-y-reajustar que congela la página — ver
 *    src/components/KeyboardScreen.js).
 */
export default function Screen({
  variant = 'grouped',
  edges = ['top', 'bottom', 'left', 'right'],
  keyboard = false,
  style,
  children,
}) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };
  const backgroundColor = variant === 'plain' ? COLORS.bgPlain : COLORS.bg;

  if (!keyboard) {
    return <View style={[styles.flex, { backgroundColor }, padding, style]}>{children}</View>;
  }
  return (
    <KeyboardScreen style={[styles.flex, { backgroundColor }]}>
      <View style={[styles.flex, padding, style]}>{children}</View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
