import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { COLORS, RADIUS, TYPE, SHADOW } from '../theme';
import haptics from './haptics';

/**
 * Control segmentado estilo iOS (§5): fondo `fill`, píldora blanca
 * deslizante. Para pestañas internas (Para ti/Siguiendo, Semana/Mes).
 * Háptica de selección al cambiar de segmento (§5), nunca en scroll.
 */
export default function SegmentedControl({ segments, selectedIndex = 0, onChange, style }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const anim = useRef(new Animated.Value(selectedIndex)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: selectedIndex,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [selectedIndex, anim]);

  const inner = Math.max(trackWidth - 4, 0);
  const segWidth = inner / (segments.length || 1);

  return (
    <View
      style={[styles.track, style]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {segWidth > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            { width: segWidth, transform: [{ translateX: Animated.multiply(anim, segWidth) }] },
          ]}
        />
      )}
      {segments.map((label, i) => (
        <Pressable
          key={label}
          style={styles.segment}
          onPress={() => {
            if (i !== selectedIndex) {
              haptics.selection();
              onChange?.(i);
            }
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === selectedIndex }}
          accessibilityLabel={label}
        >
          <Text
            style={[TYPE.subhead, styles.label, i === selectedIndex && styles.labelActive]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: COLORS.fill,
    borderRadius: RADIUS.sm,
    padding: 2,
    height: 36,
  },
  thumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.sm - 2,
    ...SHADOW,
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { color: COLORS.secondaryLabel },
  labelActive: { color: COLORS.label },
});
