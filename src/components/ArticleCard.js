import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import IllusPlaceholder from './IllusPlaceholder';
import { COLORS, FONTS } from '../theme';

export default function ArticleCard({ tone = 'lilac', label, title, duration, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
      <IllusPlaceholder tone={tone} label={label} size={140} radius={18} />
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
      <Text style={styles.duration}>{duration}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: 140, flexShrink: 0 },
  title: {
    marginTop: 8, fontFamily: FONTS.extraBold,
    fontSize: 14, color: COLORS.ink, lineHeight: 18, minHeight: 34,
  },
  duration: {
    marginTop: 4, fontFamily: FONTS.uiMedium,
    fontSize: 12, color: COLORS.inkMuted,
  },
});
