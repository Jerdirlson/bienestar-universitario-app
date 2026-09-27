import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../../ui';
import { COLORS, SPACING } from '../../theme';

// Título de sección estilo App Store/Apple Fitness (§2, §5 del sistema de
// diseño): `title2` en vez de la mayúscula pesada anterior, con un enlace de
// acción opcional en `headline` (color de acento).
export default function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <View style={styles.row}>
      <Text variant="title2" style={styles.title} numberOfLines={1}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text variant="subhead" color={COLORS.accent}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACING.md },
  title: { flexShrink: 1, color: COLORS.label },
});
