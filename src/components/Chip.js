import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, FONTS } from '../theme';

export default function Chip({ children, selected, onPress, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.chip, selected && styles.selected, style]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{children}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: 14, backgroundColor: '#F2EFFA',
    alignItems: 'center', justifyContent: 'center',
  },
  selected: { backgroundColor: COLORS.primary },
  text: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.ink },
  textSelected: { color: '#fff' },
});
