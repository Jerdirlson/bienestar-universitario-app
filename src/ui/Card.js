import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../theme';

/**
 * Tarjeta base (§5): fondo `bgElevated`, radio `lg`, padding `lg`, sin
 * sombra — la elevación es "casi plana" (§4): se distingue de `bg` por el
 * color, no por sombra.
 */
export default function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
});
