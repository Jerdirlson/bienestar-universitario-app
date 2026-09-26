import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { COLORS, RADIUS, TYPE } from '../theme';
import haptics from './haptics';

// §5: filled (acento, texto blanco), tinted (fondo acento 12%, texto
// acento), plain (solo texto acento), destructive (para borrar/cerrar
// sesión/eliminar cuenta — CLAUDE.md).
const VARIANTS = {
  filled: { bg: COLORS.accent, text: '#FFFFFF' },
  tinted: { bg: COLORS.accentTint, text: COLORS.primaryDeep },
  plain: { bg: 'transparent', text: COLORS.accent },
  destructive: { bg: 'transparent', text: COLORS.destructive },
};

/**
 * Botón base (§5). Alto 50 (48 en Android), radio `md`, texto `headline`.
 * `haptic`: impacto leve al presionar (§5) — nunca en scroll, así que solo
 * dispara en `onPress`, no en gestos de arrastre.
 */
export default function Button({
  children,
  onPress,
  variant = 'filled',
  loading = false,
  disabled = false,
  haptic = true,
  style,
  textStyle,
  testID,
  accessibilityLabel,
}) {
  const v = VARIANTS[variant] ?? VARIANTS.filled;
  const isDisabled = disabled || loading;

  const handlePress = (e) => {
    if (isDisabled) return;
    if (haptic) haptics.impactLight();
    onPress?.(e);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg },
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      hitSlop={8}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text style={[TYPE.headline, { color: v.text }, textStyle]} numberOfLines={1}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: Platform.OS === 'android' ? 48 : 50,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    // "Squircle" de Apple (§4): solo iOS entiende esta propiedad.
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
