import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';

/**
 * Envoltorio fino de Ionicons (§5: "estilo iOS", variantes `-outline` por
 * defecto y rellenas para estados activos). Centraliza tamaño y color por
 * defecto para no repetirlos en cada componente de `src/ui/`.
 */
export default function Icon({ name, size = 22, color = COLORS.label, style, ...rest }) {
  return <Ionicons name={name} size={size} color={color} style={style} {...rest} />;
}
