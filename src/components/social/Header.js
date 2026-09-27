import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../../ui/Text';
import Icon from '../../ui/Icon';
import { COLORS, SPACING } from '../../theme';
import { useApp } from '../../context/AppContext';

/**
 * Encabezado propio para Comunidad/Perfil, estilo barra de navegación de iOS
 * (§6 del sistema de diseño): título centrado, "atrás" a la izquierda.
 *
 * No se migra a un header nativo de react-navigation (`headerShown`) porque
 * esta base decidió esa migración pantalla por pantalla más adelante (ver
 * comentario en AppNavigator.js) y las rutas de este módulo se registran en
 * parte fuera de este alcance (Profile, PostDetail viven en AppNavigator.js,
 * que no se toca). Este componente imita el mismo lenguaje visual sin tocar
 * la navegación: fondo `bgElevated`, separador de 1px, texto `headline`.
 *
 * Dos modos:
 *  - Icono (por defecto): flecha "atrás" o "cerrar" a la izquierda.
 *  - Texto (`leftLabel`/`rightLabel`): barra de hoja modal estilo iOS
 *    (Cancelar / Publicar), para Compose.
 */
export default function Header({
  title,
  onBack,
  onClose,
  right,
  leftLabel,
  onLeftPress,
  rightLabel,
  onRightPress,
  rightDisabled = false,
  rightLoading = false,
}) {
  const insets = useSafeAreaInsets();
  const { t } = useApp();

  const textMode = leftLabel != null || rightLabel != null;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + SPACING.sm }]}>
      <View style={styles.side}>
        {textMode ? (
          leftLabel ? (
            <TouchableOpacity onPress={onLeftPress} hitSlop={8} accessibilityRole="button">
              <Text variant="body" color={COLORS.accent}>{leftLabel}</Text>
            </TouchableOpacity>
          ) : null
        ) : onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t.diaryBack}>
            <Icon name="chevron-back" size={26} color={COLORS.accent} />
          </TouchableOpacity>
        ) : onClose ? (
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t.socClose}>
            <Icon name="close" size={24} color={COLORS.accent} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text variant="headline" numberOfLines={1} style={styles.title}>{title}</Text>

      <View style={[styles.side, styles.sideRight]}>
        {textMode ? (
          rightLabel ? (
            <TouchableOpacity
              onPress={onRightPress}
              disabled={rightDisabled || rightLoading}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ disabled: rightDisabled, busy: rightLoading }}
            >
              {rightLoading ? (
                <ActivityIndicator color={COLORS.accent} size="small" />
              ) : (
                <Text variant="headline" color={rightDisabled ? COLORS.tertiaryLabel : COLORS.accent}>{rightLabel}</Text>
              )}
            </TouchableOpacity>
          ) : null
        ) : right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.bgElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.separator,
  },
  side: { minWidth: 44, flexDirection: 'row', alignItems: 'center' },
  sideRight: { justifyContent: 'flex-end' },
  iconBtn: { marginLeft: -8, padding: 4 },
  title: { flex: 1, textAlign: 'center', color: COLORS.label },
});
