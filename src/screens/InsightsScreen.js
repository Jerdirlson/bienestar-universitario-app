import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import IllusPlaceholder from '../components/IllusPlaceholder';
import MoodFace from '../components/MoodFace';
import TopBar from '../components/TopBar';
import { useApp } from '../context/AppContext';
import { buildMonthGrid, dayKey, monthLabel } from '../lib/dates';
import { COLORS, FONTS, SHADOW } from '../theme';

export default function InsightsScreen({ navigation }) {
  const { t, streak, entries, lang } = useApp();
  const today = new Date();

  // Mes que se está viendo. Arranca en el mes actual y se mueve con las flechas.
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const shiftMonth = (delta) => setView(({ year, month }) => {
    const d = new Date(year, month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const weeks = useMemo(() => buildMonthGrid(view.year, view.month), [view]);

  // Ánimo por día, sacado de los check-ins reales.
  const moodByDay = useMemo(() => {
    const map = new Map();
    for (const e of entries) map.set(dayKey(new Date(e.date)), e.mood);
    return map;
  }, [entries]);

  const monthHasEntries = weeks
    .flat()
    .some(d => d !== null && moodByDay.has(dayKey(new Date(view.year, view.month, d))));

  return (
    <View style={styles.container}>
      <TopBar title={t.insights} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>{t.streak}</Text>
        <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.streakBig}>{streak}</Text>
            <Text style={styles.streakLabel}>
              {streak === 0 ? t.noStreakYet : t.dayStreakShort}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <IllusPlaceholder tone="lilac" label="🔥 racha" size={72} radius={18} />
        </View>

        <Text style={styles.h1}>{t.calendar}</Text>
        <View style={styles.card}>
          <View style={styles.calHeader}>
            <TouchableOpacity
              onPress={() => shiftMonth(-1)}
              accessibilityRole="button"
              accessibilityLabel={lang === 'es' ? 'Mes anterior' : 'Previous month'}
              style={styles.navBtn}
            >
              <Svg width="10" height="18" viewBox="0 0 10 18">
                <Path d="M9 1L1 9l8 8" stroke={COLORS.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </TouchableOpacity>
            <Text style={styles.monthName}>{monthLabel(view.year, view.month, lang)}</Text>
            <TouchableOpacity
              onPress={() => shiftMonth(1)}
              accessibilityRole="button"
              accessibilityLabel={lang === 'es' ? 'Mes siguiente' : 'Next month'}
              style={styles.navBtn}
            >
              <Svg width="10" height="18" viewBox="0 0 10 18">
                <Path d="M1 1l8 8-8 8" stroke={COLORS.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </TouchableOpacity>
          </View>

          <View style={styles.daysRow}>
            {t.days.map((d, i) => (
              <Text key={i} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((d, di) => {
                if (d === null) return <View key={di} style={styles.calCell} />;
                const cellDate = new Date(view.year, view.month, d);
                const mood = moodByDay.get(dayKey(cellDate));
                const isToday = dayKey(cellDate) === dayKey(today);
                return (
                  <View key={di} style={styles.calCell}>
                    <Text style={[styles.calDay, isToday && styles.calDayToday]}>{d}</Text>
                    {mood !== undefined ? (
                      <View style={[styles.calDot, { backgroundColor: COLORS.mood[mood] }]}>
                        <MoodFace level={mood} size={24} />
                      </View>
                    ) : (
                      <View style={[styles.calDotEmpty, isToday && styles.calDotToday]} />
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          {!monthHasEntries && (
            <Text style={styles.emptyMonth}>{t.noEntriesMonth}</Text>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        onPress={() => navigation.navigate('Sos')}
        style={styles.sosFab}
      >
        <Text style={styles.sosFabText}>SOS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 100, gap: 10 },
  h1: { fontFamily: 'Nunito_800ExtraBold', fontSize: 28, color: COLORS.ink, marginTop: 14, marginBottom: 4 },
  card: { backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 20, ...SHADOW },
  streakBig: { fontFamily: 'Nunito_900Black', fontSize: 48, color: COLORS.ink, lineHeight: 52 },
  streakLabel: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft, marginTop: 4 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 8 },
  monthName: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.ink },
  daysRow: { flexDirection: 'row', marginBottom: 8 },
  dayHeader: { flex: 1, textAlign: 'center', fontFamily: FONTS.uiSemiBold, fontSize: 11, color: COLORS.inkMuted },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  calCell: { flex: 1, alignItems: 'center', gap: 4 },
  calDay: { fontFamily: FONTS.uiMedium, fontSize: 11, color: COLORS.inkMuted },
  calDayToday: { color: COLORS.primary, fontFamily: FONTS.uiBold },
  calDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  calDotEmpty: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEEBF5' },
  calDotToday: { borderWidth: 2, borderColor: COLORS.primary },
  emptyMonth: {
    fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkMuted,
    textAlign: 'center', marginTop: 12,
  },
  sosFab: {
    position: 'absolute', right: 16, bottom: 80,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#F37171',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F37171', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  sosFabText: { fontFamily: 'Nunito_900Black', fontSize: 12, color: '#fff' },
});
