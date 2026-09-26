import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from './Icon';
import Button from './Button';
import { COLORS, SPACING, TYPE } from '../theme';

/**
 * Estado vacío (§5): icono grande en gris, título `title3`, texto `subhead`,
 * acción opcional.
 */
export default function EmptyState({ icon = 'leaf-outline', title, subtitle, actionLabel, onAction, style }) {
  return (
    <View style={[styles.wrapper, style]} accessibilityRole="text">
      <Icon name={icon} size={48} color={COLORS.tertiaryLabel} />
      {title ? <Text style={[TYPE.title3, styles.title]}>{title}</Text> : null}
      {subtitle ? <Text style={[TYPE.subhead, styles.subtitle]}>{subtitle}</Text> : null}
      {actionLabel ? (
        <Button variant="tinted" onPress={onAction} style={styles.action}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl, gap: SPACING.xs },
  title: { color: COLORS.label, marginTop: SPACING.sm, textAlign: 'center' },
  subtitle: { color: COLORS.secondaryLabel, textAlign: 'center' },
  action: { marginTop: SPACING.md, paddingHorizontal: SPACING.xl },
});
