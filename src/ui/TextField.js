import React from 'react';
import { TextInput, StyleSheet, Platform } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';

/**
 * Campo de texto de una línea (§5): fondo `bgElevated`, radio `md`, `body`.
 */
export function TextField({ style, ...rest }) {
  return (
    <TextInput
      placeholderTextColor={COLORS.tertiaryLabel}
      style={[styles.field, style]}
      {...rest}
    />
  );
}

/** Igual que `TextField`, pero de varias líneas y alineado arriba. */
export function TextArea({ style, minHeight = 96, ...rest }) {
  return (
    <TextInput
      placeholderTextColor={COLORS.tertiaryLabel}
      style={[styles.field, styles.area, { minHeight }, style]}
      multiline
      textAlignVertical="top"
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.label,
    minHeight: 44,
    ...TYPE.body,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  area: { paddingTop: SPACING.sm },
});

export default TextField;
