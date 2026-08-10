import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, FONTS } from '../theme';

export default function PrimaryButton({ children, onPress, disabled, style }) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.8}
      style={[styles.btn, disabled && styles.disabled, style]}
    >
      <Text style={styles.text}>{children}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%', paddingVertical: 18, paddingHorizontal: 20,
    borderRadius: RADIUS.pill, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
  },
  disabled: {
    backgroundColor: '#C6C3D1', shadowOpacity: 0, elevation: 0,
  },
  text: {
    color: '#fff', fontFamily: FONTS.extraBold,
    fontSize: 16, letterSpacing: 0.5, textTransform: 'uppercase',
  },
});
