import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useApp } from '../../context/AppContext';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../theme';

/** Cargando / vacío / error, con reintentar. */
export function StateView({ loading, error, empty, onRetry, style }) {
  const { t } = useApp();
  if (loading) return <ActivityIndicator style={[{ marginTop: 32 }, style]} color={COLORS.primary} />;
  if (error) {
    return (
      <View style={[styles.state, style]}>
        <Text style={styles.stateEmoji}>🌧️</Text>
        <Text style={styles.stateText}>{error}</Text>
        {onRetry ? (
          <TouchableOpacity style={styles.retry} onPress={onRetry}>
            <Text style={styles.retryText}>{t.socRetry}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={[styles.state, style]}>
        <Text style={styles.stateEmoji}>🌱</Text>
        <Text style={styles.stateText}>{empty}</Text>
      </View>
    );
  }
  return null;
}

/** Chip pequeño seleccionable (temas, orden). */
export function Pill({ label, selected, onPress, style, small }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.pill, small && styles.pillSmall, selected && styles.pillSelected, style]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
    >
      <Text style={[styles.pillText, small && styles.pillTextSmall, selected && styles.pillTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Fila horizontal de temas con "Todos" al inicio (value null). */
export function TopicChips({ topics, value, onChange, labels, allLabel, contentStyle }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipsRow, contentStyle]} keyboardShouldPersistTaps="handled">
      {allLabel ? <Pill small label={allLabel} selected={!value} onPress={() => onChange(null)} /> : null}
      {topics.map(k => (
        <Pill key={k} small label={labels[k]} selected={value === k} onPress={() => onChange(value === k && allLabel ? null : k)} />
      ))}
    </ScrollView>
  );
}

/** Control segmentado de dos o más opciones. */
export function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segment}>
      {options.map(o => (
        <TouchableOpacity
          key={o.value}
          style={[styles.segmentItem, value === o.value && styles.segmentActive]}
          onPress={() => onChange(o.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === o.value }}
        >
          <Text style={[styles.segmentText, value === o.value && styles.segmentTextActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Campanita con contador de no leídas. */
export function BellButton({ count = 0, onPress, label }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.bell} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label}>
      <Svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <Path d="M9 2.5a4.5 4.5 0 00-4.5 4.5v2.8L3 12.5h12l-1.5-2.7V7A4.5 4.5 0 009 2.5z" stroke={COLORS.ink} strokeWidth="1.6" strokeLinejoin="round" />
        <Path d="M7.2 14.5a1.9 1.9 0 003.6 0" stroke={COLORS.ink} strokeWidth="1.6" strokeLinecap="round" />
      </Svg>
      {count > 0 ? (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText} allowFontScaling={false}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/** Botón de tres puntos. */
export function MoreButton({ onPress, label }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={10} style={styles.more} accessibilityRole="button" accessibilityLabel={label}>
      <Svg width="18" height="4" viewBox="0 0 18 4">
        <Circle cx="2" cy="2" r="1.8" fill={COLORS.inkMuted} />
        <Circle cx="9" cy="2" r="1.8" fill={COLORS.inkMuted} />
        <Circle cx="16" cy="2" r="1.8" fill={COLORS.inkMuted} />
      </Svg>
    </TouchableOpacity>
  );
}

/** Fila de menú para Perfil. */
export function MenuRow({ label, onPress, value, badge, destructive, last }) {
  return (
    <TouchableOpacity style={[styles.row, last && { borderBottomWidth: 0 }]} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <Text style={[styles.rowLabel, destructive && { color: '#D93B4A' }]}>{label}</Text>
      {badge > 0 ? (
        <View style={styles.rowBadge}><Text style={styles.rowBadgeText}>{badge > 99 ? '99+' : badge}</Text></View>
      ) : null}
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {!destructive ? (
        <Svg width="8" height="14" viewBox="0 0 8 14"><Path d="M1 1l6 6-6 6" stroke={COLORS.inkMuted} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>
      ) : null}
    </TouchableOpacity>
  );
}

export const cardStyle = { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, ...SHADOW };

const styles = StyleSheet.create({
  state: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 10 },
  stateEmoji: { fontSize: 30 },
  stateText: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.inkSoft, textAlign: 'center', lineHeight: 20 },
  retry: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.pill, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.primary },
  pill: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: '#F2EFFA' },
  pillSmall: { paddingVertical: 7, paddingHorizontal: 12 },
  pillSelected: { backgroundColor: COLORS.primary },
  pillText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.ink },
  pillTextSmall: { fontSize: 13 },
  pillTextSelected: { color: '#fff' },
  chipsRow: { gap: 8, paddingVertical: 2 },
  segment: { flexDirection: 'row', backgroundColor: '#F2EFFA', borderRadius: RADIUS.pill, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: COLORS.bgCard, ...SHADOW, shadowOpacity: 0.08, elevation: 2 },
  segmentText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.inkSoft },
  segmentTextActive: { color: COLORS.ink },
  bell: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', ...SHADOW,
  },
  bellBadge: {
    position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: COLORS.upbRed, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff',
  },
  bellBadgeText: { fontFamily: FONTS.uiBold, fontSize: 9, color: '#fff' },
  more: { paddingHorizontal: 4, paddingVertical: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.hair,
  },
  rowLabel: { flex: 1, fontFamily: FONTS.uiSemiBold, fontSize: 14, color: COLORS.ink },
  rowValue: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft },
  rowBadge: { backgroundColor: COLORS.upbRed, borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  rowBadgeText: { fontFamily: FONTS.uiBold, fontSize: 11, color: '#fff' },
});
