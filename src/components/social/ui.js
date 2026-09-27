import React from 'react';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Text from '../../ui/Text';
import Icon from '../../ui/Icon';
import EmptyState from '../../ui/EmptyState';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING } from '../../theme';

/**
 * Ayudantes chicos, sin equivalente en `src/ui/` (chips de tema, control
 * segmentado y demás pasaron a usarse directo desde ahí — ver
 * CommunityScreen, ComposeScreen). Lo que queda aquí es específico de
 * comunidad: estado de una lista, y el botón de "más opciones" de tarjetas.
 */

/** Cargando / vacío / error, con reintentar (§5: EmptyState de src/ui). */
export function StateView({ loading, error, empty, onRetry, style }) {
  const { t } = useApp();
  if (loading) return <ActivityIndicator style={[{ marginTop: SPACING.xxl }, style]} color={COLORS.accent} />;
  if (error) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title={error}
        actionLabel={onRetry ? t.socRetry : undefined}
        onAction={onRetry}
        style={style}
      />
    );
  }
  if (empty) {
    return <EmptyState icon="leaf-outline" title={empty} style={style} />;
  }
  return null;
}

/** Botón de "más opciones" (tres puntos), usado en tarjetas y comentarios. */
export function MoreButton({ onPress, label }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={10} style={styles.more} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name="ellipsis-horizontal" size={18} color={COLORS.tertiaryLabel} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  more: { paddingHorizontal: 4, paddingVertical: 8 },
});
