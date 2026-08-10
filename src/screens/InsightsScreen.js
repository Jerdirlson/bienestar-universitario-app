import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import IllusPlaceholder from '../components/IllusPlaceholder';
import MoodFace from '../components/MoodFace';
import TopBar from '../components/TopBar';
import { useApp } from '../context/AppContext';
import { COLORS, FONTS, SHADOW } from '../theme';

const WEEKS = [
  [null, null, 1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10, 11, 12],
  [13, 14, 15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24, 25, 26],
  [27, 28, 29, 30, null, null, null],
];
const FILLED = new Set([15, 16, 17, 18, 20, 21, 22]);
const TODAY = 22;

export default function InsightsScreen({ navigation }) {
  const { t, streak } = useApp();

  return (
    <View style={styles.container}>
      <TopBar title={t.insights} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>{t.streak}</Text>
        <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
          <View>
            <Text style={styles.streakBig}>{streak}</Text>
            <Text style={styles.streakLabel}>{t.dayStreakShort}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <IllusPlaceholder tone="lilac" label="🔥 racha" size={72} radius={18} />
        </View>

        <Text style={styles.h1}>{t.calendar}</Text>
        <View style={styles.card}>
          <View style={styles.calHeader}>
            <TouchableOpacity style={styles.navBtn}>
              <Svg width="10" height="18" viewBox="0 0 10 18">
                <Path d="M9 1L1 9l8 8" stroke={COLORS.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </TouchableOpacity>
            <Text style={styles.monthName}>{t.monthName}</Text>
            <TouchableOpacity style={styles.navBtn}>
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

          {WEEKS.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((d, di) => {
                if (d === null) return <View key={di} style={styles.calCell} />;
                const isFilled = FILLED.has(d);
                const isToday = d === TODAY;
                const mood = isFilled ? [2, 3, 3, 4, 2, 3, 3][d % 7] : null;
                return (
                  <View key={di} style={styles.calCell}>
                    <Text style={[styles.calDay, isToday && styles.calDayToday]}>{d}</Text>
                    {isFilled ? (
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
