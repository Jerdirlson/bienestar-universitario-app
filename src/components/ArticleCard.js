import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import IllusPlaceholder from './IllusPlaceholder';
import { Text } from '../ui';
import { COLORS, RADIUS, SPACING } from '../theme';

// Tarjeta de artículo/recurso, estilo App Store: imagen grande, título
// `headline`, metadato `footnote` (§2, §5 del sistema de diseño).
export default function ArticleCard({ tone = 'lilac', label, title, duration, imageUrl, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <IllusPlaceholder tone={tone} label={label} size={140} radius={RADIUS.lg} />
      )}
      <Text variant="headline" numberOfLines={2} style={styles.title}>{title}</Text>
      <Text variant="footnote" color={COLORS.tertiaryLabel} style={styles.duration}>{duration}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: 140, flexShrink: 0 },
  image: { width: 140, height: 140, borderRadius: RADIUS.lg, backgroundColor: COLORS.separator },
  title: { marginTop: SPACING.sm, color: COLORS.label, minHeight: 44 },
  duration: { marginTop: 2 },
});
