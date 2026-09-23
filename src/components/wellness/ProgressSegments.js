import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';

/**
 * Barra de progreso de un reto. Hasta 14 días se dibuja por segmentos (un
 * segmento = un día); más allá, una barra continua para que siga legible.
 */
export default function ProgressSegments({ done = 0, total = 1, light = false, height = 6 }) {
  const trackColor = light ? 'rgba(255,255,255,0.3)' : '#EEEBF5';
  const fillColor = light ? '#fff' : COLORS.primary;
  const safeTotal = Math.max(1, total);
  const safeDone = Math.max(0, Math.min(done, safeTotal));

  if (safeTotal > 14) {
    return (
      <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }]}>
        <View style={{ width: `${(safeDone / safeTotal) * 100}%`, height, borderRadius: height / 2, backgroundColor: fillColor }} />
      </View>
    );
  }
  return (
    <View style={styles.row}>
      {Array.from({ length: safeTotal }).map((_, i) => (
        <View
          key={i}
          style={[styles.segment, { height, borderRadius: height / 2, backgroundColor: i < safeDone ? fillColor : trackColor }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1 },
  track: { width: '100%', overflow: 'hidden' },
});
