import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import IllusPlaceholder from '../components/IllusPlaceholder';
import MoodFace from '../components/MoodFace';
import PrimaryButton from '../components/PrimaryButton';
import TopBar from '../components/TopBar';
import { useApp } from '../context/AppContext';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';

export default function HomeScreen({ navigation }) {
  const { t, mood, streak, lang, userName, userEmail, entryForDay } = useApp();
  const today = new Date();
  const dateStr = today.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // t.days empieza en lunes (ver dates.js: buildMonthGrid usa la misma
  // convención). getDay() da 0 para domingo, así que se corre para que
  // lunes sea 0 — de ahí sale qué celda es "hoy" de verdad, en vez de un
  // índice fijo que solo era correcto un miércoles.
  const todayIndex = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - todayIndex);

  return (
    <View style={styles.container}>
      <TopBar title={t.daily} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Yesterday */}
        <View style={[styles.card, { backgroundColor: COLORS.tones.peach.bg }]}>
          <IllusPlaceholder tone="peach" label="calendario" size={72} radius={14} />
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>{t.yesterday}</Text>
            <Text style={styles.cardSub}>{t.missed}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Checkin1')}
              style={styles.smallBtn}
            >
              <Text style={styles.smallBtnText}>{t.checkin}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today check-in */}
        <View style={[styles.card2, { backgroundColor: COLORS.primarySoft }]}>
          <View style={styles.dateRow}>
            <Svg width="14" height="14" viewBox="0 0 14 14">
              <Circle cx="7" cy="7" r="3" fill={COLORS.primary} />
              <Path d="M7 1v1M7 12v1M1 7h1M12 7h1M2.5 2.5l0.7 0.7M10.8 10.8l0.7 0.7M2.5 11.5l0.7-0.7M10.8 3.2l0.7-0.7"
                stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
            </Svg>
            <Text style={styles.dateText}>{dateStr} · 1 min</Text>
          </View>
          {/* Sin display_name todavía: mientras tanto mostramos el correo real
              de la sesión, para que se note que la información viene del
              backend y no es un valor inventado. */}
          <Text style={styles.greeting}>
            {userName ? `${t.goodMorning}, ${userName}` : t.goodMorning}
          </Text>
          {userEmail && <Text style={styles.sessionEmail}>{userEmail}</Text>}
          <View style={styles.moodRow}>
            {[0, 1, 2, 3, 4].map(i => (
              <TouchableOpacity
                key={i}
                onPress={() => navigation.navigate('Checkin1', { initialMood: i })}
              >
                <MoodFace level={i} size={48} />
              </TouchableOpacity>
            ))}
          </View>
          <PrimaryButton onPress={() => navigation.navigate('Checkin1')}>
            {t.howsDay}
          </PrimaryButton>
        </View>

        {/* Today's journal */}
        <View style={[styles.shadowCard]}>
          <Text style={styles.sectionTitle}>{t.todaysJournal}</Text>
          <View style={styles.journalRow}>
            <IllusPlaceholder tone="sun" label="gratitud" size={66} radius={14} />
            <View style={styles.journalText}>
              <Text style={styles.journalTitle}>{t.gratitudeTitle}</Text>
              <Text style={styles.journalSub}>{t.gratitudePrompt}</Text>
            </View>
          </View>
        </View>

        {/* Weekly streak */}
        <View style={styles.shadowCard}>
          <View style={styles.streakHeader}>
            <Text style={styles.sectionTitle}>{t.weeklyStreak}</Text>
            <Text style={styles.streakFire}>{streak} 🔥</Text>
          </View>
          <View style={styles.daysRow}>
            {t.days.map((d, i) => {
              const cellDate = new Date(monday);
              cellDate.setDate(monday.getDate() + i);
              const done = Boolean(entryForDay(cellDate));
              const isToday = i === todayIndex;
              return (
                <View key={i} style={styles.dayCell}>
                  <Text style={styles.dayLabel}>{d}</Text>
                  <View style={[
                    styles.dayCircle,
                    done && styles.dayCircleDone,
                    isToday && styles.dayCircleToday,
                  ]}>
                    {done && (
                      <Svg width="14" height="14" viewBox="0 0 14 14">
                        <Path d="M2 7l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </Svg>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* SOS FAB */}
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
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 100, gap: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 22, padding: 18,
  },
  cardTextWrap: { flex: 1 },
  cardTitle: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.ink },
  cardSub: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft, marginTop: 2, marginBottom: 10 },
  smallBtn: {
    alignSelf: 'flex-start', backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill, paddingVertical: 8, paddingHorizontal: 18,
  },
  smallBtnText: { fontFamily: FONTS.extraBold, fontSize: 12, color: '#fff', letterSpacing: 0.6, textTransform: 'uppercase' },
  card2: { borderRadius: 22, padding: 22 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  dateText: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.inkSoft },
  greeting: { fontFamily: FONTS.extraBold, fontSize: 24, color: COLORS.ink, marginBottom: 2 },
  sessionEmail: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, marginBottom: 12 },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  shadowCard: {
    backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 16,
    ...SHADOW,
  },
  sectionTitle: { fontFamily: FONTS.extraBold, fontSize: 16, color: COLORS.ink, marginBottom: 12 },
  journalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  journalText: { flex: 1 },
  journalTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink },
  journalSub: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, marginTop: 2, lineHeight: 18 },
  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  streakFire: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.inkSoft },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCell: { alignItems: 'center', gap: 6 },
  dayLabel: { fontFamily: FONTS.uiSemiBold, fontSize: 11, color: COLORS.inkMuted },
  dayCircle: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEEBF5',
    alignItems: 'center', justifyContent: 'center',
  },
  dayCircleDone: { backgroundColor: COLORS.primary },
  dayCircleToday: { borderWidth: 2, borderColor: COLORS.primary },
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
