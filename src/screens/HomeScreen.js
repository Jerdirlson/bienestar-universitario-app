import React from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IllusPlaceholder from '../components/IllusPlaceholder';
import MoodFace from '../components/MoodFace';
import { useApp } from '../context/AppContext';
import { dayKey } from '../lib/dates';
import { COLORS, SPACING, RADIUS, SHADOW_FLOATING } from '../theme';
import { Screen, Text, Button, Card, Icon, haptics } from '../ui';
import { dayLabel, fmt, routeExists, SyncBadge } from './journal/diaryUi';

// Alto aproximado del contenido de la barra de pestañas (icono + etiqueta +
// su padding superior — ver src/components/TabBar.js), SIN el área segura
// inferior: esa parte se suma aparte con `insets.bottom`, que sí cambia por
// dispositivo. H1 de la auditoría: a 360×640 el botón "Escribir" quedaba
// tapado porque el aire de abajo no seguía el alto real de la barra flotante
// ni el área segura del teléfono, solo un número fijo pensado para 390px.
const TAB_BAR_CONTENT = 58;
const SOS_SIZE = 56;

const initialsFromEmail = (email) => {
  const local = email?.split('@')[0] ?? '';
  return local.slice(0, 2).toUpperCase();
};

export default function HomeScreen({ navigation }) {
  const {
    t, streak, lang, userName, userEmail, entryForDay, startCheckin, journal, ready,
  } = useApp();
  const insets = useSafeAreaInsets();
  const tabBarClearance = insets.bottom + TAB_BAR_CONTENT;

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

  const pickMood = (i) => {
    haptics.selection();
    openCheckin({ initialMood: i });
  };

  const hasBreathing = routeExists(navigation, 'Breathing');
  const hasGrounding = routeExists(navigation, 'Grounding');

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance + SOS_SIZE + SPACING.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Título grande a la izquierda + acceso al perfil, como en las
            pestañas raíz de Apple Salud/Ajustes (§5, §6). */}
        <View style={styles.headerRow}>
          <Text variant="largeTitle">{t.daily}</Text>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            style={styles.avatar}
            accessibilityRole="button"
            accessibilityLabel={t.profileTitle}
          >
            {userEmail ? (
              <Text variant="subhead" color={COLORS.accent}>{initialsFromEmail(userEmail)}</Text>
            ) : (
              <Icon name="person-outline" size={18} color={COLORS.accent} />
            )}
          </Pressable>
        </View>
        {/* H4: aviso discreto si el último intento de sincronizar falló —
            antes Inicio no decía nada y parecía todo al día igual. */}
        <SyncBadge align="left" style={styles.syncRow} />

        {/* Ayer sin registro: se puede registrar tarde. */}
        {ready && !yesterdayEntry && (
          <Card style={[styles.card, { backgroundColor: COLORS.tones.peach.bg }]}>
            <View style={styles.rowGap}>
              <IllusPlaceholder tone="peach" label="calendario" size={64} radius={RADIUS.md} />
              <View style={styles.flex1}>
                <Text variant="headline">{t.yesterday}</Text>
                <Text variant="subhead" color={COLORS.secondaryLabel} style={styles.mtXs}>{t.missed}</Text>
                <Button
                  variant="tinted"
                  onPress={() => openCheckin({ date: yesterday })}
                  style={styles.inlineBtn}
                >
                  {t.checkin}
                </Button>
              </View>
            </View>
          </Card>
        )}

        {/* Check-in de hoy: la tarjeta principal de la pantalla. */}
        <Card style={[styles.card, styles.heroCard]}>
          <View style={styles.dateRow}>
            <Icon name="calendar-outline" size={14} color={COLORS.accent} />
            <Text variant="footnote" color={COLORS.secondaryLabel}>
              {dateStr}{todayEntry ? '' : ` · ${fmt(t.diaryMinutes, { n: 1 })}`}
            </Text>
          </View>
          <Text variant="title2" style={styles.mtXs}>
            {userName ? `${greetingWord}, ${userName}` : greetingWord}
          </Text>

          {todayEntry ? (
            <View style={styles.doneRow}>
              <MoodFace level={todayEntry.mood} size={56} />
              <View style={styles.flex1}>
                <Text variant="headline">{t.diaryTodayDone}</Text>
                <Text variant="subhead" color={COLORS.secondaryLabel} style={styles.mtXs}>
                  {t.moods[todayEntry.mood]} · {t.diaryTodayDoneSub}
                </Text>
              </View>
              <Button variant="tinted" onPress={() => openCheckin()} style={styles.inlineBtn}>
                {t.diaryEdit}
              </Button>
            </View>
          ) : (
            <>
              <View style={styles.moodRow}>
                {[0, 1, 2, 3, 4].map(i => (
                  <Pressable
                    key={i}
                    onPress={() => pickMood(i)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t.moods[i]}
                  >
                    <MoodFace level={i} size={48} />
                  </Pressable>
                ))}
              </View>
              <Button onPress={() => openCheckin()} style={styles.mtMd}>
                {t.howsDay}
              </Button>
            </>
          )}
        </Card>

        {/* Gratitud: abre el editor con el prompt guiado */}
        <Pressable
          style={({ pressed }) => [styles.card, styles.pressableCard, pressed && styles.pressed]}
          onPress={() => navigation.navigate('JournalEditor', { promptKey: 'gratitude' })}
          accessibilityRole="button"
        >
          <Text variant="headline" style={styles.mbMd}>{t.todaysJournal}</Text>
          <View style={styles.rowGap}>
            <IllusPlaceholder tone="sun" label="gratitud" size={64} radius={RADIUS.md} />
            <View style={styles.flex1}>
              <Text variant="body">{t.gratitudeTitle}</Text>
              <Text variant="subhead" color={COLORS.secondaryLabel} style={styles.mtXs}>
                {gratitudeToday ? t.diaryGratitudeDoneToday : t.gratitudePrompt}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Diario libre */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text variant="headline">{t.diaryJournalCardTitle}</Text>
            {journal.length > 0 && (
              <Button variant="plain" onPress={() => navigation.navigate('Journal')} haptic={false}>
                {t.diarySeeAll}
              </Button>
            )}
          </View>
          <View style={[styles.rowGap, styles.mtMd]}>
            <IllusPlaceholder tone="lilac" label="diario" size={64} radius={RADIUS.md} />
            <View style={styles.flex1}>
              {journal.length === 0 ? (
                <Text variant="subhead" color={COLORS.secondaryLabel}>{t.diaryJournalCardEmpty}</Text>
              ) : (
                <>
                  <Text variant="body">
                    {journal.length === 1 ? t.diaryEntriesOne : fmt(t.diaryEntriesMany, { n: journal.length })}
                  </Text>
                  <Text variant="subhead" color={COLORS.secondaryLabel} numberOfLines={1} style={styles.mtXs}>
                    {fmt(t.diaryLastEntry, { date: dayLabel(dayKey(new Date(lastJournal.createdAt)), t, lang).toLowerCase() })}
                  </Text>
                </>
              )}
              <Button
                variant="tinted"
                onPress={() => navigation.navigate('JournalEditor', {})}
                style={styles.inlineBtn}
              >
                {t.diaryWrite}
              </Button>
            </View>
          </View>
        </View>

        {/* Bienestar: solo si esas pantallas existen en esta versión de la app */}
        {(hasBreathing || hasGrounding) && (
          <View style={styles.card}>
            <Text variant="headline" style={styles.mbMd}>{t.diaryForNowTitle}</Text>
            <View style={{ gap: SPACING.md }}>
              {hasBreathing && (
                <Pressable style={styles.wellRow} onPress={() => navigation.navigate('Breathing')} accessibilityRole="button">
                  <IllusPlaceholder tone="sky" label="respirar" size={44} radius={RADIUS.sm} />
                  <View style={styles.flex1}>
                    <Text variant="body">{t.diaryBreathingShort}</Text>
                    <Text variant="footnote" color={COLORS.secondaryLabel}>{t.diaryBreathingSub}</Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color={COLORS.tertiaryLabel} />
                </Pressable>
              )}
              {hasGrounding && (
                <Pressable style={styles.wellRow} onPress={() => navigation.navigate('Grounding')} accessibilityRole="button">
                  <IllusPlaceholder tone="mint" label="mindful" size={44} radius={RADIUS.sm} />
                  <View style={styles.flex1}>
                    <Text variant="body">{t.diaryGroundingShort}</Text>
                    <Text variant="footnote" color={COLORS.secondaryLabel}>{t.diaryGroundingSub}</Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color={COLORS.tertiaryLabel} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Semana actual: días con check-in real */}
        <View style={[styles.card, styles.lastCard]}>
          <View style={styles.rowBetween}>
            <Text variant="headline">{t.weeklyStreak}</Text>
            <View style={styles.streakBadge}>
              <Icon name="flame" size={14} color={COLORS.tones.peach.ink} />
              <Text variant="subhead" color={COLORS.secondaryLabel}>{streak}</Text>
            </View>
          </View>
          <View style={[styles.daysRow, styles.mtLg]}>
            {t.days.map((d, i) => {
              const cellDate = new Date(monday);
              cellDate.setDate(monday.getDate() + i);
              const done = Boolean(entryForDay(cellDate));
              const isToday = i === todayIndex;
              return (
                <View key={i} style={styles.dayCell}>
                  <Text variant="caption1" color={COLORS.tertiaryLabel}>{d}</Text>
                  <View style={[
                    styles.dayCircle,
                    done && styles.dayCircleDone,
                    isToday && styles.dayCircleToday,
                  ]}>
                    {done && <Icon name="checkmark" size={14} color="#fff" />}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* SOS: siempre visible, con aire suficiente para no tapar ni ser
          tapado por la barra de pestañas (H1/H5). */}
      <Pressable
        onPress={() => navigation.navigate('Sos')}
        style={[styles.sosFab, { bottom: tabBarClearance + SPACING.sm }]}
        accessibilityRole="button"
        accessibilityLabel={t.sos}
      >
        <Text variant="footnote" color="#fff" style={styles.sosText}>SOS</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accentTint,
    alignItems: 'center', justifyContent: 'center',
  },
  syncRow: { marginBottom: SPACING.md },
  flex1: { flex: 1 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mtXs: { marginTop: SPACING.xs },
  mtMd: { marginTop: SPACING.md },
  mtLg: { marginTop: SPACING.lg },
  mbMd: { marginBottom: SPACING.md },
  card: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  lastCard: { marginBottom: 0 },
  pressableCard: {},
  pressed: { opacity: 0.85 },
  heroCard: { backgroundColor: COLORS.accentTint },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.md },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.lg },
  inlineBtn: { alignSelf: 'flex-start', marginTop: SPACING.sm, paddingHorizontal: SPACING.lg, minHeight: 36 },
  wellRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCell: { alignItems: 'center', gap: SPACING.xs },
  dayCircle: {
    width: 30, height: 30, borderRadius: RADIUS.pill, backgroundColor: COLORS.fill,
    alignItems: 'center', justifyContent: 'center',
  },
  dayCircleDone: { backgroundColor: COLORS.accent },
  dayCircleToday: { borderWidth: 2, borderColor: COLORS.accent },
  sosFab: {
    position: 'absolute', right: SPACING.lg,
    width: SOS_SIZE, height: SOS_SIZE, borderRadius: SOS_SIZE / 2,
    backgroundColor: COLORS.sos,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW_FLOATING,
  },
  sosText: { letterSpacing: 0.4 },
});
