import React from 'react';
import { View, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import Icon from './Icon';
import { COLORS, SPACING, TYPE } from '../theme';

/**
 * Campo de búsqueda estilo iOS (§5): fondo `fill`, icono de lupa, radio 10,
 * alto 36. `onClear` opcional muestra una "x" para vaciar el campo.
 */
export default function SearchField({
  value,
  onChangeText,
  placeholder,
  onClear,
  // Texto para lectores de pantalla del botón de vaciar: la app es bilingüe
  // y este componente no depende de i18n.js, así que quien lo use pasa su
  // propia traducción (ver §10: todo texto visible/anunciado vía i18n).
  clearAccessibilityLabel = 'Limpiar',
  style,
  accessibilityLabel,
  ...rest
}) {
  return (
    <View style={[styles.wrapper, style]}>
      <Icon name="search" size={18} color={COLORS.secondaryLabel} style={styles.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.tertiaryLabel}
        style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' }]}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        returnKeyType="search"
        {...rest}
      />
      {onClear && value ? (
        <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button" accessibilityLabel={clearAccessibilityLabel}>
          <Icon name="close-circle" size={18} color={COLORS.tertiaryLabel} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 10, // §5: radio 10 fijo para el campo de búsqueda
    backgroundColor: COLORS.fill,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  icon: { marginRight: 2 },
  input: {
    flex: 1,
    height: '100%',
    color: COLORS.label,
    ...TYPE.body,
    paddingVertical: 0,
  },
});
