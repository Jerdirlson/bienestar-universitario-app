import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import IllusPlaceholder from '../components/IllusPlaceholder';
import MoodFace from '../components/MoodFace';
import PrimaryButton from '../components/PrimaryButton';
import TopBar from '../components/TopBar';
import { useApp } from '../context/AppContext';
import { dayKey } from '../lib/dates';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';
import { dayLabel, fmt, routeExists } from './journal/diaryUi';

export default function HomeScreen({ navigation }) {
  const {
    t, streak, lang, userName, userEmail, entryForDay, startCheckin, journal, ready,
  } = useApp();
  const today = new Date();
  const dateStr = today.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const hour = today.getHours();
  const greetingWord = hour < 12 ? t.goodMorning : hour < 19 ? t.diaryGoodAfternoon : t.diaryGoodEvening;

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const todayEntry = entryForDay(today);
  const yesterdayEntry = entryForDay(yesterday);

  // t.days empieza en lunes (ver dates.js: buildMonthGrid usa la misma
  // convención). getDay() da 0 para domingo, así que se corre para que
  // lunes sea 0 — de ahí sale qué celda es "hoy" de verdad.
  const todayIndex = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - todayIndex);

  // Diario libre: cuántas entradas hay y cuándo fue la última.
  const lastJournal = journal[0] ?? null;
  const todayKey = dayKey(today);
  const gratitudeToday = journal.some(
    j => j.promptKey === 'gratitude' && dayKey(new Date(j.createdAt)) === todayKey
  );

  const openCheckin = ({ date = null, initialMood } = {}) => {
    startCheckin({ date, initialMood });
    navigation.navigate('Checkin1', Number.isInteger(initialMood) ? { initialMood } : undefined);
  };

  const hasBreathing = routeExists(navigation, 'Breathing');
  const hasGrounding = routeExists(navigation, 'Grounding');

  return (
    <View style={styles.container}>
      <TopBar title={t.daily} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Ayer sin registro: se puede registrar tarde. */}
        {ready && !yesterdayEntry && (
          <View style={[styles.card, { backgroundColor: COLORS.tones.peach.bg }]}>
            <IllusPlaceholder tone="peach" label="calendario" size={72} radius={14} />
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>{t.yesterday}</Text>
              <Text style={styles.cardSub}>{t.missed}</Text>
              <TouchableOpacity
                onPress={() => openCheckin({ date: yesterday })}
                style={styles.smallBtn}
              >
                <Text style={styles.smallBtnText}>{t.checkin}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Check-in de hoy */}
        <View style={[styles.card2, { backgroundColor: COLORS.primarySoft }]}>
          <View style={styles.dateRow}>
            <Svg width="14" height="14" viewBox="0 0 14 14">
              <Circle cx="7" cy="7" r="3" fill={COLORS.primary} />
              <Path d="M7 1v1M7 12v1M1 7h1M12 7h1M2.5 2.5l0.7 0.7M10.8 10.8l0.7 0.7M2.5 11.5l0.7-0.7M10.8 3.2l0.7-0.7"
                stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
            </Svg>
            <Text style={styles.dateText}>
              {dateStr}{todayEntry ? '' : ` · ${fmt(t.diaryMinutes, { n: 1 })}`}
            </Text>
          </View>
          <Text style={styles.greeting}>
            {userName ? `${greetingWord}, ${userName}` : greetingWord}
          </Text>
          {userEmail && <Text style={styles.sessionEmail}>{userEmail}</Text>}

          {todayEntry ? (
            <View style={styles.doneRow}>
              <MoodFace level={todayEntry.mood} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={styles.doneTitle}>{t.diaryTodayDone}</Text>
                <Text style={styles.doneSub}>{t.moods[todayEntry.mood]} · {t.diaryTodayDoneSub}</Text>
              </View>
              <TouchableOpacity onPress={() => openCheckin()} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>{t.diaryEdit}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.moodRow}>
                {[0, 1, 2, 3, 4].map(i => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => openCheckin({ initialMood: i })}
                    accessibilityRole="button"
                    accessibilityLabel={t.moods[i]}
                  >
                    <MoodFace level={i} size={48} />
                  </TouchableOpacity>
                ))}
              </View>
              <PrimaryButton onPress={() => openCheckin()}>
                {t.howsDay}
              </PrimaryButton>
            </>
          )}
        </View>

        {/* Gratitud: abre el editor con el prompt guiado */}
        <TouchableOpacity
          style={styles.shadowCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('JournalEditor', { promptKey: 'gratitude' })}
        >
          <Text style={styles.sectionTitle}>{t.todaysJournal}</Text>
          <View style={styles.journalRow}>
            <IllusPlaceholder tone="sun" label="gratitud" size={66} radius={14} />
            <View style={styles.journalText}>
              <Text style={styles.journalTitle}>{t.gratitudeTitle}</Text>
              <Text style={styles.journalSub}>
                {gratitudeToday ? t.diaryGratitudeDoneToday : t.gratitudePrompt}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Diario libre */}
        <View style={styles.shadowCard}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t.diaryJournalCardTitle}</Text>
            {journal.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('Journal')} accessibilityRole="button">
                <Text style={styles.link}>{t.diarySeeAll}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.journalRow, { marginTop: 12 }]}>
            <IllusPlaceholder tone="lilac" label="diario" size={66} radius={14} />
            <View style={styles.journalText}>
              {journal.length === 0 ? (
                <Text style={styles.journalSub}>{t.diaryJournalCardEmpty}</Text>
              ) : (
                <>
                  <Text style={styles.journalTitle}>
                    {journal.length === 1 ? t.diaryEntriesOne : fmt(t.diaryEntriesMany, { n: journal.length })}
                  </Text>
                  <Text style={styles.journalSub} numberOfLines={1}>
                    {fmt(t.diaryLastEntry, { date: dayLabel(dayKey(new Date(lastJournal.createdAt)), t, lang).toLowerCase() })}
                  </Text>
                </>
              )}
              <TouchableOpacity
                onPress={() => navigation.navigate('JournalEditor', {})}
                style={[styles.smallBtn, { marginTop: 10 }]}
              >
                <Text style={styles.smallBtnText}>{t.diaryWrite}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bienestar: solo si esas pantallas existen en esta versión de la app */}
        {(hasBreathing || hasGrounding) && (
          <View style={styles.shadowCard}>
            <Text style={styles.sectionTitle}>{t.diaryForNowTitle}</Text>
            <View style={{ gap: 10 }}>
              {hasBreathing && (
                <TouchableOpacity style={styles.wellRow} onPress={() => navigation.navigate('Breathing')}>
                  <IllusPlaceholder tone="sky" label="respirar" size={44} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.journalTitle}>{t.diaryBreathingShort}</Text>
                    <Text style={styles.journalSub}>{t.diaryBreathingSub}</Text>
                  </View>
                </TouchableOpacity>
              )}
              {hasGrounding && (
                <TouchableOpacity style={styles.wellRow} onPress={() => navigation.navigate('Grounding')}>
                  <IllusPlaceholder tone="mint" label="mindful" size={44} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.journalTitle}>{t.diaryGroundingShort}</Text>
                    <Text style={styles.journalSub}>{t.diaryGroundingSub}</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Semana actual: días con check-in real */}
        <View style={styles.shadowCard}>
          <View style={styles.streakHeader}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t.weeklyStreak}</Text>
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
        accessibilityRole="button"
        accessibilityLabel={t.sos}
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
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, marginTop: 6 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  doneTitle: { fontFamily: FONTS.extraBold, fontSize: 16, color: COLORS.ink },
  doneSub: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, marginTop: 2 },
  shadowCard: {
    backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 16,
    ...SHADOW,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.primary },
  sectionTitle: { fontFamily: FONTS.extraBold, fontSize: 16, color: COLORS.ink, marginBottom: 12 },
  journalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  journalText: { flex: 1 },
  journalTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink },
  journalSub: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, marginTop: 2, lineHeight: 18 },
  wellRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
