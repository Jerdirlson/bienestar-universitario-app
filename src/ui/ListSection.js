import React, { Children, cloneElement } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';

/**
 * Agrupa `ListRow` en una tarjeta blanca de esquinas redondeadas, como los
 * grupos de "Ajustes" en iOS (§5). Marca automáticamente la última fila
 * (`last`) para que no dibuje separador inferior — así cada `ListRow` no
 * necesita saber su posición dentro del grupo.
 *
 * `title`/`footer`: `footnote` en `secondaryLabel`, en oración normal (§10:
 * nada de MAYÚSCULAS).
 */
export default function ListSection({ title, footer, children, style }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.wrapper, style]}>
      {title ? <Text style={[TYPE.footnote, styles.title]}>{title}</Text> : null}
      <View style={styles.card}>
        {items.map((child, i) => cloneElement(child, { key: child.key ?? i, last: i === items.length - 1 }))}
      </View>
      {footer ? <Text style={[TYPE.footnote, styles.footer]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: SPACING.lg },
  title: { color: COLORS.secondaryLabel, marginBottom: SPACING.xs, marginLeft: SPACING.lg },
  card: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  footer: { color: COLORS.secondaryLabel, marginTop: SPACING.xs, marginHorizontal: SPACING.lg },
});
