import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IllusPlaceholder from '../components/IllusPlaceholder';
import MoodFace from '../components/MoodFace';
import { useApp } from '../context/AppContext';
import { buildMonthGrid, dayKey, monthLabel } from '../lib/dates';
import { periodStats, longestStreak } from '../lib/insights';
import { COLORS, SPACING, RADIUS, SHADOW_FLOATING } from '../theme';
import { Screen, Text, Button, Card, SegmentedControl, Icon, haptics } from '../ui';
import { SyncBadge, dayLabel, fmt, locale } from './journal/diaryUi';
import { showAlert } from '../components/dialogs';

// Ver comentario homólogo en HomeScreen.js (H1/H5 de la auditoría): aire
// suficiente para que ni la barra de pestañas ni el SOS flotante tapen el
// último bloque de contenido, calculado sobre el área segura real.
const TAB_BAR_CONTENT = 58;
const SOS_SIZE = 56;
const CHART_H = 96;

// Mismo helper que HomeScreen.js/TopBar.js: iniciales del correo para el
// avatar cuando no hay foto de perfil.
const initialsFromEmail = (email) => {
  const local = email?.split('@')[0] ?? '';
  return local.slice(0, 2).toUpperCase();
};

/** Barras de ánimo por día: altura y color dicen lo mismo (el color nunca va solo). */
function MoodBars({ series, t, lang }) {
  const [selected, setSelected] = useState(null);
  const dense = series.length > 10;
  const sel = selected != null ? series[selected] : null;
  return (
    <View>
      <View style={styles.chart}>
        {series.map((p, i) => {
          const h = p.mood == null ? 4 : ((p.mood + 1) / 5) * CHART_H;
          return (
            <Pressable
              key={p.date}
              style={styles.barHit}
              onPress={() => setSelected(selected === i ? null : i)}
              accessibilityRole="button"
              accessibilityLabel={`${dayLabel(p.date, t, lang)}: ${p.mood == null ? '—' : t.moods[p.mood]}`}
            >
              <View
                style={[
                  styles.bar,
                  { height: h, width: dense ? 5 : 16 },
                  p.mood == null ? { backgroundColor: COLORS.fill } : { backgroundColor: COLORS.mood[p.mood] },
                  selected === i && styles.barSelected,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis} />
      {!dense && (
        <View style={styles.axisLabels}>
          {series.map((p) => {
            const [y, m, d] = p.date.split('-').map(Number);
            const wd = (new Date(y, m - 1, d).getDay() + 6) % 7;
            return <Text key={p.date} variant="caption2" color={COLORS.tertiaryLabel} style={styles.axisLabel}>{t.days[wd]}</Text>;
          })}
        </View>
      )}
      <Text variant="footnote" color={COLORS.secondaryLabel} style={styles.chartReadout}>
        {sel ? `${dayLabel(sel.date, t, lang)} · ${sel.mood == null ? '—' : t.moods[sel.mood]}` : ' '}
      </Text>
    </View>
  );
}

function TopList({ title, items, labels, t }) {
  return (
    <View style={styles.topList}>
      <Text variant="footnote" color={COLORS.secondaryLabel}>{title}</Text>
      {items.length === 0 ? (
        <Text variant="footnote" color={COLORS.tertiaryLabel} style={styles.mtXs}>{t.diaryNothingYet}</Text>
      ) : items.map(({ k, count }) => (
        <View key={k} style={styles.topRow}>
          <View style={styles.tag}>
            <Text variant="caption1" color={COLORS.label}>{labels.find(i => i.k === k)?.label ?? k}</Text>
          </View>
          <Text variant="caption1" color={COLORS.tertiaryLabel}>{count === 1 ? t.diaryTimesOne : fmt(t.diaryTimesMany, { n: count })}</Text>
        </View>
      ))}
    </View>
  );
}

export default function InsightsScreen({ navigation }) {
  const { t, streak, entries, journal, lang, startCheckin, deleteEntry, ready, userEmail } = useApp();
  const insets = useSafeAreaInsets();
  const tabBarClearance = insets.bottom + TAB_BAR_CONTENT;
  const today = new Date();
  const todayKey = dayKey(today);

  const [range, setRange] = useState(7);
  const stats = useMemo(() => periodStats(entries, range, new Date()), [entries, range]);
  const best = useMemo(() => longestStreak(entries), [entries]);

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
    for (const e of entries) map.set(e.entryDate, e.mood);
    return map;
  }, [entries]);

  // Día tocado en el calendario, para mostrar su check-in completo en un modal.
  const [previewDate, setPreviewDate] = useState(null);
  const previewEntry = previewDate ? entries.find(e => e.entryDate === previewDate) : null;
  const labelFor = (items, k) => items.find(i => i.k === k)?.label ?? k;
  // dayLabel pone en mayúscula solo la primera letra ('Jueves, 10 de septiembre');
  // textTransform: 'capitalize' daba 'Jueves, 10 De Septiembre'.
  const previewDateLabel = previewDate ? dayLabel(previewDate, t, lang) : '';

  const monthHasEntries = weeks
    .flat()
    .some(d => d !== null && moodByDay.has(dayKey(new Date(view.year, view.month, d))));

  // Abre el check-in de ese día (nuevo o para editar) en la pestaña de inicio.
  const openDay = (key) => {
    setPreviewDate(null);
    startCheckin({ date: key });
    // Al terminar (o cerrar) vuelve aquí, no a Inicio.
    navigation.navigate('home', { screen: 'Checkin1', params: { returnTo: 'insights' } });
  };

  const confirmDelete = (key) => {
    showAlert(t.diaryDeleteCheckinTitle, t.diaryDeleteBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.diaryDelete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEntry(key);
            setPreviewDate(null);
          } catch {
            showAlert(t.diarySaveErrorTitle, t.diaryDeleteError);
          }
        },
      },
    ]);
  };

  const avgLevel = stats.average == null ? null : Math.round(stats.average);
  const trendText = stats.delta == null ? null
    : stats.delta > 0.25 ? t.diaryBetter
    : stats.delta < -0.25 ? t.diaryWorse
    : t.diarySame;

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance + SOS_SIZE + SPACING.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Título grande + acceso al perfil, igual que Inicio (H-e2e): antes
            Progreso era la única pestaña raíz sin forma de llegar al perfil,
            así que "Perfil" solo existía mientras se estaba en Inicio o
            Comunidad — un usuario que abría el SOS desde aquí y volvía se
            quedaba sin ese acceso. */}
        <View style={styles.headerRow}>
          <Text variant="largeTitle">{t.insights}</Text>
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
        {/* H4: mismo aviso discreto que Inicio cuando el último intento de
            sincronizar falló — antes solo Comunidad lo mostraba. */}
        <SyncBadge align="left" style={styles.syncRow} />

        <Card style={[styles.card, styles.streakCard]}>
          <View style={styles.flex1}>
            <Text variant="largeTitle">{streak}</Text>
            <Text variant="subhead" color={COLORS.secondaryLabel} style={styles.mtXs}>
              {streak === 0 ? t.noStreakYet : t.dayStreakShort}
            </Text>
            {best > 1 && <Text variant="footnote" color={COLORS.tertiaryLabel} style={styles.mtXs}>{fmt(t.diaryLongestStreak, { n: best })}</Text>}
          </View>
          <IllusPlaceholder tone="lilac" label="🔥 racha" size={64} radius={RADIUS.md} />
        </Card>

        <Text variant="title2" style={styles.sectionTitle}>{t.diaryTrendsTitle}</Text>
        <Card style={styles.card}>
          <SegmentedControl
            segments={[t.diaryWeek, t.diaryMonth]}
            selectedIndex={range === 7 ? 0 : 1}
            onChange={(i) => setRange(i === 0 ? 7 : 30)}
          />
          <Text variant="footnote" color={COLORS.tertiaryLabel} style={styles.mtMd}>{range === 7 ? t.diaryLast7 : t.diaryLast30}</Text>

          {ready && stats.count === 0 ? (
            <Text variant="callout" color={COLORS.secondaryLabel} style={styles.mtMd}>{t.diaryNoDataPeriod}</Text>
          ) : (
            <>
              <View style={styles.statRow}>
                <View style={styles.statBox}>
                  <Text variant="footnote" color={COLORS.secondaryLabel}>{t.diaryAvgMood}</Text>
                  <View style={styles.avgRow}>
                    {avgLevel != null && <MoodFace level={avgLevel} size={32} />}
                    <View>
                      <Text variant="headline">{avgLevel != null ? t.moods[avgLevel] : '—'}</Text>
                      {stats.average != null && <Text variant="caption1" color={COLORS.tertiaryLabel}>{stats.average.toFixed(1)} / 4</Text>}
                    </View>
                  </View>
                </View>
                <View style={styles.statBox}>
                  <Text variant="footnote" color={COLORS.secondaryLabel}>{t.diaryCheckinsCount}</Text>
                  <Text variant="headline" style={styles.mtXs}>{stats.count} / {range}</Text>
                </View>
              </View>
              {trendText && <Text variant="footnote" color={COLORS.secondaryLabel} style={styles.mtMd}>{trendText}</Text>}

              <MoodBars series={stats.series} t={t} lang={lang} />

              <View style={styles.topWrap}>
                <TopList title={t.diaryTopFeelings} items={stats.topFeelings} labels={t.feelingItems} t={t} />
                <TopList title={t.diaryTopCauses} items={stats.topCauses} labels={t.causeItems} t={t} />
              </View>
            </>
          )}
        </Card>

        <Pressable
          style={({ pressed }) => [styles.card, styles.journalStat, pressed && styles.pressed]}
          onPress={() => navigation.navigate('Journal')}
          accessibilityRole="button"
        >
          <IllusPlaceholder tone="lilac" label="diario" size={48} radius={RADIUS.md} />
          <View style={styles.flex1}>
            <Text variant="footnote" color={COLORS.secondaryLabel}>{t.diaryJournalStat}</Text>
            <Text variant="headline">{journal.length}</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={COLORS.tertiaryLabel} />
        </Pressable>

        <Text variant="title2" style={styles.sectionTitle}>{t.calendar}</Text>
        <Card style={[styles.card, styles.lastCard]}>
          <View style={styles.calHeader}>
            <Pressable onPress={() => shiftMonth(-1)} accessibilityRole="button" accessibilityLabel={t.diaryPrevMonth} style={styles.navBtn}>
              <Icon name="chevron-back" size={20} color={COLORS.label} />
            </Pressable>
            <Text variant="headline">{monthLabel(view.year, view.month, lang)}</Text>
            <Pressable onPress={() => shiftMonth(1)} accessibilityRole="button" accessibilityLabel={t.diaryNextMonth} style={styles.navBtn}>
              <Icon name="chevron-forward" size={20} color={COLORS.label} />
            </Pressable>
          </View>

          <View style={styles.daysRow}>
            {t.days.map((d, i) => (
              <Text key={i} variant="caption1" color={COLORS.tertiaryLabel} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((d, di) => {
                if (d === null) return <View key={di} style={styles.calCell} />;
                const cellDate = new Date(view.year, view.month, d);
                const cellKey = dayKey(cellDate);
                const mood = moodByDay.get(cellKey);
                const isToday = cellKey === todayKey;
                const hasEntry = mood !== undefined;
                const isFuture = cellKey > todayKey;
                return (
                  <Pressable
                    key={di}
                    style={styles.calCell}
                    disabled={isFuture}
                    // Con registro: vista previa (editar / borrar). Sin registro: registrarlo.
                    onPress={() => (hasEntry ? setPreviewDate(cellKey) : openDay(cellKey))}
                    accessibilityLabel={hasEntry ? `${d}: ${t.moods[mood]}` : `${d}: ${t.diaryAddForDay}`}
                  >
                    <Text variant="caption1" color={isToday ? COLORS.accent : COLORS.tertiaryLabel} style={isFuture && styles.dim}>{d}</Text>
                    {hasEntry ? (
                      <View style={styles.calDot}><MoodFace level={mood} size={24} /></View>
                    ) : (
                      <View style={[styles.calDotEmpty, isToday && styles.calDotToday, isFuture && styles.dim]} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}

          {!monthHasEntries && (
            <Text variant="footnote" color={COLORS.tertiaryLabel} style={styles.emptyMonth}>{t.noEntriesMonth}</Text>
          )}
        </Card>
      </ScrollView>

      <Pressable
        onPress={() => navigation.navigate('Sos')}
        style={[styles.sosFab, { bottom: tabBarClearance + SPACING.sm }]}
        accessibilityRole="button"
        accessibilityLabel={t.sos}
      >
        <Text variant="footnote" color="#fff">SOS</Text>
      </Pressable>

      <Modal
        visible={previewEntry != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewDate(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPreviewDate(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {previewEntry && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.flex1}>
                    <Text variant="subhead" color={COLORS.secondaryLabel}>{previewDateLabel}</Text>
                    <Text variant="title2" style={styles.mtXs}>{t.moods[previewEntry.mood]}</Text>
                  </View>
                  <MoodFace level={previewEntry.mood} size={44} />
                </View>

                {(previewEntry.feelings.length > 0 || previewEntry.causes.length > 0) && (
                  <View style={styles.tagWrap}>
                    {previewEntry.feelings.map(k => (
                      <View key={`f-${k}`} style={styles.tag}>
                        <Text variant="caption1">{labelFor(t.feelingItems, k)}</Text>
                      </View>
                    ))}
                    {previewEntry.causes.map(k => (
                      <View key={`c-${k}`} style={[styles.tag, styles.tagCause]}>
                        <Text variant="caption1">{labelFor(t.causeItems, k)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <ScrollView style={styles.modalNoteScroll}>
                  <Text variant="body" style={styles.modalNote}>
                    {previewEntry.note?.trim() ? previewEntry.note : t.dayPreviewNoNote}
                  </Text>
                </ScrollView>

                <View style={styles.modalActions}>
                  <Button variant="filled" onPress={() => openDay(previewEntry.entryDate)} style={styles.flex1}>
                    {t.diaryEdit}
                  </Button>
                  <Button variant="tinted" onPress={() => confirmDelete(previewEntry.entryDate)} style={[styles.flex1, styles.deleteBtn]} textStyle={styles.deleteBtnText}>
                    {t.diaryDelete}
                  </Button>
                </View>

                {/* H6: el "×" era visualmente pequeño Y su área táctil real
                    apenas llegaba a 32×32 — ahora el objetivo real es 44×44,
                    aunque el ícono visible se mantenga discreto. */}
                <Pressable
                  onPress={() => setPreviewDate(null)}
                  hitSlop={4}
                  style={styles.modalCloseBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t.socClose}
                >
                  <Icon name="close-circle" size={26} color={COLORS.tertiaryLabel} />
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  mtXs: { marginTop: SPACING.xs },
  mtMd: { marginTop: SPACING.md },
  card: { backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md },
  lastCard: { marginBottom: 0 },
  pressed: { opacity: 0.85 },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  sectionTitle: { marginTop: SPACING.sm, marginBottom: SPACING.sm },
  statRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  statBox: { flex: 1, backgroundColor: COLORS.fill, borderRadius: RADIUS.md, padding: SPACING.md },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: CHART_H, marginTop: SPACING.lg },
  barHit: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: CHART_H },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barSelected: { borderWidth: 1.5, borderColor: COLORS.label },
  axis: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.separator },
  axisLabels: { flexDirection: 'row', marginTop: SPACING.xs },
  axisLabel: { flex: 1, textAlign: 'center' },
  chartReadout: { marginTop: SPACING.xs, textAlign: 'center' },
  topWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg, marginTop: SPACING.md },
  topList: { flex: 1, minWidth: 140 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.xs },
  journalStat: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  daysRow: { flexDirection: 'row', marginBottom: SPACING.xs },
  dayHeader: { flex: 1, textAlign: 'center' },
  weekRow: { flexDirection: 'row', marginBottom: SPACING.xs },
  calCell: { flex: 1, alignItems: 'center', gap: SPACING.xs, minHeight: 44, justifyContent: 'center' },
  dim: { opacity: 0.4 },
  calDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  calDotEmpty: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.fill },
  calDotToday: { borderWidth: 2, borderColor: COLORS.accent },
  emptyMonth: { textAlign: 'center', marginTop: SPACING.md },
  sosFab: {
    position: 'absolute', right: SPACING.lg,
    width: SOS_SIZE, height: SOS_SIZE, borderRadius: SOS_SIZE / 2,
    backgroundColor: COLORS.sos, alignItems: 'center', justifyContent: 'center',
    ...SHADOW_FLOATING,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  modalCard: { width: '100%', maxWidth: 380, backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md, paddingRight: SPACING.xl },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  tag: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.sm, backgroundColor: COLORS.fill },
  tagCause: { backgroundColor: COLORS.tones.peach.bg },
  modalNoteScroll: { maxHeight: 220 },
  modalNote: { color: COLORS.label },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  deleteBtn: { backgroundColor: COLORS.tones.rose.bg },
  deleteBtnText: { color: COLORS.destructive },
  modalCloseBtn: {
    position: 'absolute', top: SPACING.xs, right: SPACING.xs,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
});
