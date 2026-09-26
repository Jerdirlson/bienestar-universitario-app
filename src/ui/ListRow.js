import React from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import Icon from './Icon';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';

/**
 * Fila de una lista agrupada inset estilo Ajustes (§5): icono opcional en
 * cuadrado de color, texto `body`, valor secundario a la derecha y chevron.
 *
 * `last` lo pone `ListSection` (clonando a sus hijos): el separador vive en
 * la fila, no en el contenedor, así arranca después del icono como en HIG en
 * vez de pegado al borde de la tarjeta.
 */
export default function ListRow({
  icon,
  iconColor = COLORS.accent,
  label,
  value,
  onPress,
  destructive = false,
  switchValue,
  onSwitchChange,
  last = false,
  disabled = false,
  testID,
  accessibilityLabel,
}) {
  const isSwitchRow = typeof switchValue === 'boolean';

  const content = (
    <>
      {icon ? (
        <View style={[styles.iconBox, { backgroundColor: iconColor }]}>
          <Icon name={icon} size={18} color="#FFFFFF" />
        </View>
      ) : null}
      <Text
        style={[TYPE.body, styles.label, destructive && { color: COLORS.destructive }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {isSwitchRow ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ true: COLORS.accent }}
          accessibilityLabel={accessibilityLabel ?? label}
        />
      ) : (
        <>
          {value ? (
            <Text style={[TYPE.body, styles.value]} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {onPress ? <Icon name="chevron-forward" size={18} color={COLORS.tertiaryLabel} /> : null}
        </>
      )}
    </>
  );

  // El separador arranca después del icono, no del borde de la tarjeta (HIG
  // y §5: "separadores de 1 px con sangría"), así que va como línea propia
  // con el margen izquierdo del icono en vez de un borde de todo el ancho.
  const separator = !last ? (
    <View style={[styles.separator, icon && styles.separatorIndented]} />
  ) : null;

  // Filas con switch no son "presionables" completas: el propio Switch es el
  // control tocable (evita el toque accidental de activar/desactivar al
  // tocar cualquier parte de la fila).
  if (onPress && !isSwitchRow) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
      >
        {({ pressed }) => (
          <>
            <View style={[styles.row, pressed && styles.pressed]}>{content}</View>
            {separator}
          </>
        )}
      </Pressable>
    );
  }

  return (
    <View testID={testID}>
      <View style={styles.row}>{content}</View>
      {separator}
    </View>
  );
}

const ICON_BOX = 28;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    backgroundColor: COLORS.bgElevated,
  },
  pressed: { backgroundColor: COLORS.fill },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.separator,
    marginLeft: SPACING.lg,
  },
  separatorIndented: { marginLeft: SPACING.lg + ICON_BOX + SPACING.sm },
  iconBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, color: COLORS.label },
  value: { color: COLORS.secondaryLabel, marginRight: SPACING.xs },
});
