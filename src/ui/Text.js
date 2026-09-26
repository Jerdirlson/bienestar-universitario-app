import React from 'react';
import { Text as RNText } from 'react-native';
import { TYPE, COLORS } from '../theme';

/**
 * Texto con `variant` de la escala tipográfica (§2). Nunca fija
 * `allowFontScaling={false}`: el tamaño de texto dinámico de accesibilidad
 * tiene que poder crecer (§2, §9).
 */
export default function Text({ variant = 'body', color = COLORS.label, style, children, ...rest }) {
  return (
    <RNText style={[TYPE[variant] ?? TYPE.body, { color }, style]} {...rest}>
      {children}
    </RNText>
  );
}
