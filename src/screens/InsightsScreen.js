import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import IllusPlaceholder from '../components/IllusPlaceholder';
import MoodFace from '../components/MoodFace';
import TopBar from '../components/TopBar';
import { useApp } from '../context/AppContext';
import { buildMonthGrid, dayKey, monthLabel } from '../lib/dates';
import { periodStats, longestStreak } from '../lib/insights';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';
import { SyncBadge, dayLabel, fmt, locale } from './journal/diaryUi';

const CHART_H = 96;

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
            <TouchableOpacity
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
                  p.mood == null
                    ? { backgroundColor: '#EEEBF5' }
                    : { backgroundColor: COLORS.mood[p.mood] },
                  selected === i && styles.barSelected,
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.axis} />
      {!dense && (
        <View style={styles.axisLabels}>
          {series.map((p) => {
            const [y, m, d] = p.date.split('-').map(Number);
            const wd = (new Date(y, m - 1, d).getDay() + 6) % 7;
            return <Text key={p.date} style={styles.axisLabel}>{t.days[wd]}</Text>;
          })}
        </View>
      )}
      <Text style={styles.chartReadout}>
        {sel ? `${dayLabel(sel.date, t, lang)} · ${sel.mood == null ? '—' : t.moods[sel.mood]}` : ' '}
      </Text>
    </View>
  );
}

function TopList({ title, items, labels, t, tone }) {
  return (
    <View style={{ flex: 1, minWidth: 140 }}>
      <Text style={styles.statLabel}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.muted}>{t.diaryNothingYet}</Text>
      ) : items.map(({ k, count }) => (
        <View key={k} style={styles.topRow}>
          <View style={[styles.tag, tone === 'cause' && styles.tagCause]}>
            <Text style={styles.tagText}>{labels.find(i => i.k === k)?.label ?? k}</Text>
          </View>
          <Text style={styles.muted}>{count === 1 ? t.diaryTimesOne : fmt(t.diaryTimesMany, { n: count })}</Text>
        </View>
      ))}
    </View>
  );
}

export default function InsightsScreen({ navigation }) {
  const { t, streak, entries, journal, lang, startCheckin, deleteEntry, ready } = useApp();
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
  const previewDateLabel = previewDate
    ? new Date(`${previewDate}T00:00:00`).toLocaleDateString(locale(lang), {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : '';

  const monthHasEntries = weeks
    .flat()
    .some(d => d !== null && moodByDay.has(dayKey(new Date(view.year, view.month, d))));

  // Abre el check-in de ese día (nuevo o para editar) en la pestaña de inicio.
  const openDay = (key) => {
    setPreviewDate(null);
    startCheckin({ date: key });
    navigation.navigate('home', { screen: 'Checkin1' });
  };

  const confirmDelete = (key) => {
    Alert.alert(t.diaryDeleteCheckinTitle, t.diaryDeleteBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.diaryDelete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEntry(key);
            setPreviewDate(null);
          } catch {
            Alert.alert(t.diarySaveErrorTitle, t.diaryDeleteError);
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
            {best > 1 && <Text style={styles.muted}>{fmt(t.diaryLongestStreak, { n: best })}</Text>}
          </View>
          <View style={{ flex: 1 }} />
          <IllusPlaceholder tone="lilac" label="🔥 racha" size={72} radius={18} />
        </View>

        <Text style={styles.h1}>{t.diaryTrendsTitle}</Text>
        <View style={styles.card}>
          <View style={styles.segment}>
            {[[7, t.diaryWeek], [30, t.diaryMonth]].map(([n, label]) => (
              <TouchableOpacity
                key={n}
                style={[styles.segBtn, range === n && styles.segBtnOn]}
                onPress={() => setRange(n)}
                accessibilityRole="button"
                accessibilityState={{ selected: range === n }}
              >
                <Text style={[styles.segText, range === n && styles.segTextOn]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.rangeLabel}>{range === 7 ? t.diaryLast7 : t.diaryLast30}</Text>

          {ready && stats.count === 0 ? (
            <Text style={styles.emptyText}>{t.diaryNoDataPeriod}</Text>
          ) : (
            <>
              <View style={styles.statRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>{t.diaryAvgMood}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {avgLevel != null && <MoodFace level={avgLevel} size={32} />}
                    <View>
                      <Text style={styles.statValue}>{avgLevel != null ? t.moods[avgLevel] : '—'}</Text>
                      {stats.average != null && <Text style={styles.muted}>{stats.average.toFixed(1)} / 4</Text>}
                    </View>
                  </View>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>{t.diaryCheckinsCount}</Text>
                  <Text style={[styles.statValue, { marginTop: 4 }]}>{stats.count} / {range}</Text>
                </View>
              </View>
              {trendText && <Text style={styles.trendText}>{trendText}</Text>}

              <MoodBars series={stats.series} t={t} lang={lang} />

              <View style={styles.topWrap}>
                <TopList title={t.diaryTopFeelings} items={stats.topFeelings} labels={t.feelingItems} t={t} />
                <TopList title={t.diaryTopCauses} items={stats.topCauses} labels={t.causeItems} t={t} tone="cause" />
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.card, styles.journalStat]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Journal')}
        >
          <IllusPlaceholder tone="lilac" label="diario" size={48} radius={14} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statLabel}>{t.diaryJournalStat}</Text>
            <Text style={styles.statValue}>{journal.length}</Text>
          </View>
          <Svg width="10" height="18" viewBox="0 0 10 18">
            <Path d="M1 1l8 8-8 8" stroke={COLORS.inkMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </TouchableOpacity>

        <Text style={styles.h1}>{t.calendar}</Text>
        <View style={styles.card}>
          <View style={styles.calHeader}>
            <TouchableOpacity
              onPress={() => shiftMonth(-1)}
              accessibilityRole="button"
              accessibilityLabel={t.diaryPrevMonth}
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
              accessibilityLabel={t.diaryNextMonth}
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
                const cellKey = dayKey(cellDate);
                const mood = moodByDay.get(cellKey);
                const isToday = cellKey === todayKey;
                const hasEntry = mood !== undefined;
                const isFuture = cellKey > todayKey;
                return (
                  <TouchableOpacity
                    key={di}
                    style={styles.calCell}
                    disabled={isFuture}
                    activeOpacity={0.6}
                    // Con registro: vista previa (editar / borrar). Sin registro: registrarlo.
                    onPress={() => (hasEntry ? setPreviewDate(cellKey) : openDay(cellKey))}
                    accessibilityLabel={hasEntry ? `${d}: ${t.moods[mood]}` : `${d}: ${t.diaryAddForDay}`}
                  >
                    <Text style={[styles.calDay, isToday && styles.calDayToday, isFuture && { opacity: 0.4 }]}>{d}</Text>
                    {hasEntry ? (
                      <View style={[styles.calDot, { backgroundColor: COLORS.mood[mood] }]}>
                        <MoodFace level={mood} size={24} />
                      </View>
                    ) : (
                      <View style={[styles.calDotEmpty, isToday && styles.calDotToday, isFuture && { opacity: 0.4 }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {!monthHasEntries && (
            <Text style={styles.emptyMonth}>{t.noEntriesMonth}</Text>
          )}
        </View>
        <SyncBadge style={{ marginTop: 6 }} />
      </ScrollView>

      <TouchableOpacity
        onPress={() => navigation.navigate('Sos')}
        style={styles.sosFab}
        accessibilityRole="button"
        accessibilityLabel={t.sos}
      >
        <Text style={styles.sosFabText}>SOS</Text>
      </TouchableOpacity>

      <Modal
        visible={previewEntry != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewDate(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPreviewDate(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard} onPress={() => {}}>
            {previewEntry && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalDate}>{previewDateLabel}</Text>
                    <Text style={styles.modalMoodLabel}>{t.moods[previewEntry.mood]}</Text>
                  </View>
                  <MoodFace level={previewEntry.mood} size={44} />
                </View>

                {(previewEntry.feelings.length > 0 || previewEntry.causes.length > 0) && (
                  <View style={styles.tagWrap}>
                    {previewEntry.feelings.map(k => (
                      <View key={`f-${k}`} style={styles.tag}>
                        <Text style={styles.tagText}>{labelFor(t.feelingItems, k)}</Text>
                      </View>
                    ))}
                    {previewEntry.causes.map(k => (
                      <View key={`c-${k}`} style={[styles.tag, styles.tagCause]}>
                        <Text style={styles.tagText}>{labelFor(t.causeItems, k)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <ScrollView style={{ maxHeight: 220 }}>
                  <Text style={styles.modalNote}>
                    {previewEntry.note?.trim() ? previewEntry.note : t.dayPreviewNoNote}
                  </Text>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
                    onPress={() => openDay(previewEntry.entryDate)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>{t.diaryEdit}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#FDECEE' }]}
                    onPress={() => confirmDelete(previewEntry.entryDate)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.modalBtnText, { color: '#D93B4A' }]}>{t.diaryDelete}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPreviewDate(null)}>
                  <Text style={styles.modalCloseBtnText}>×</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  muted: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkMuted, marginTop: 2 },
  segment: { flexDirection: 'row', backgroundColor: '#F2EFFA', borderRadius: RADIUS.pill, padding: 4, alignSelf: 'flex-start' },
  segBtn: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: RADIUS.pill },
  segBtnOn: { backgroundColor: COLORS.bgCard, ...SHADOW },
  segText: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.inkSoft },
  segTextOn: { color: COLORS.ink },
  rangeLabel: { fontFamily: FONTS.uiMedium, fontSize: 12, color: COLORS.inkMuted, marginTop: 10 },
  emptyText: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.inkSoft, lineHeight: 20, marginTop: 12 },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  statBox: { flex: 1, backgroundColor: '#F7F5FC', borderRadius: 14, padding: 12 },
  statLabel: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.inkSoft },
  statValue: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.ink },
  trendText: { fontFamily: FONTS.uiMedium, fontSize: 12, color: COLORS.inkSoft, marginTop: 10 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: CHART_H, marginTop: 18 },
  barHit: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: CHART_H },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barSelected: { borderWidth: 1.5, borderColor: COLORS.ink },
  axis: { height: 1, backgroundColor: COLORS.hair },
  axisLabels: { flexDirection: 'row', marginTop: 6 },
  axisLabel: { flex: 1, textAlign: 'center', fontFamily: FONTS.uiSemiBold, fontSize: 11, color: COLORS.inkMuted },
  chartReadout: { fontFamily: FONTS.uiMedium, fontSize: 12, color: COLORS.inkSoft, marginTop: 8, textAlign: 'center' },
  topWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  journalStat: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
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
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(26,21,35,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', maxWidth: 360, backgroundColor: '#fff',
    borderRadius: 24, padding: 20, ...SHADOW,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, paddingRight: 28 },
  modalDate: { fontFamily: FONTS.uiSemiBold, fontSize: 13, color: COLORS.inkSoft, textTransform: 'capitalize' },
  modalMoodLabel: { fontFamily: FONTS.extraBold, fontSize: 20, color: COLORS.ink, marginTop: 2 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  tag: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: '#F2EFFA',
  },
  tagCause: { backgroundColor: '#FDEFE3' },
  tagText: { fontFamily: FONTS.bold, fontSize: 12, color: COLORS.ink },
  modalNote: {
    fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink,
    lineHeight: 20,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, borderRadius: RADIUS.pill, paddingVertical: 12, alignItems: 'center' },
  modalBtnText: { fontFamily: FONTS.extraBold, fontSize: 13, letterSpacing: 0.4 },
  modalCloseBtn: {
    position: 'absolute', top: 12, right: 12,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F2EFFA',
  },
  modalCloseBtnText: { fontFamily: FONTS.extraBold, fontSize: 16, color: COLORS.inkSoft, marginTop: -2 },
});
