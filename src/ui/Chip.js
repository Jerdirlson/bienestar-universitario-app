import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import haptics from './haptics';

/**
 * Chip (§5): radio 16, `subhead`, inactivo `fill`, activo `accentTint` +
 * texto acento. Distinta de `src/components/Chip.js` (la versión vieja que
 * ya usan las pantallas sin migrar) — esta es la que adoptan las pantallas
 * rediseñadas.
 */
export default function Chip({ children, selected = false, onPress, style, accessibilityLabel }) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
    >
      <Text style={[TYPE.subhead, styles.text, selected && styles.textSelected]} numberOfLines={1}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 32,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg, // 16, como pide el §5
    backgroundColor: COLORS.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: COLORS.accentTint },
  pressed: { opacity: 0.7 },
  text: { color: COLORS.label },
  textSelected: { color: COLORS.accent },
});
