import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MoodFace from '../../components/MoodFace';
import IllusPlaceholder from '../../components/IllusPlaceholder';
import { useApp } from '../../context/AppContext';
import { dayKey } from '../../lib/dates';
import { COLORS, SPACING, RADIUS } from '../../theme';
import { Screen, Text, Button } from '../../ui';
import { CrisisCard, PROMPT_STYLE, ScreenHeader, SyncBadge, dayLabel, fmt, locale, promptFor, timeLabel } from './diaryUi';
import { showAlert } from '../../components/dialogs';

/** Una entrada del diario libre. params: { id, crisis? } */
export default function JournalEntryScreen({ navigation, route }) {
  const { id, crisis } = route.params ?? {};
  const { t, lang, journalById, deleteJournal } = useApp();
  const insets = useSafeAreaInsets();
  const [showCrisis, setShowCrisis] = useState(Boolean(crisis));
  // Al volver del editor (popTo) esta pantalla sigue montada y solo cambian
  // los parámetros: si lo editado tiene señales de riesgo, la tarjeta vuelve.
  useEffect(() => { if (crisis) setShowCrisis(true); }, [crisis, route.params]);
  const entry = id ? journalById(id) : null;

  if (!entry) {
    return (
      <Screen variant="plain" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t.diaryJournalTitle} onBack={() => navigation.goBack()} />
        <Text variant="callout" color={COLORS.secondaryLabel} style={styles.notFound}>{t.diaryEntryNotFound}</Text>
      </Screen>
    );
  }

  const prompt = promptFor(t, entry.promptKey);
  const edited = Date.parse(entry.updatedAt) - Date.parse(entry.createdAt) > 60 * 1000;

  // H12 de la auditoría: en vez de dejar más de media pantalla en blanco tras
  // los botones, se aprovecha con metadatos de lectura reales de la entrada.
  const words = entry.body.trim() ? entry.body.trim().split(/\s+/).length : 0;
  const readMinutes = Math.max(1, Math.round(words / 200));

  const confirmDelete = () => {
    showAlert(t.diaryDeleteTitle, t.diaryDeleteBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.diaryDelete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteJournal(entry.id);
            navigation.goBack();
          } catch {
            showAlert(t.diarySaveErrorTitle, t.diaryDeleteError);
          }
        },
      },
    ]);
  };

  return (
    <Screen variant="plain" edges={['top', 'left', 'right']}>
      <ScreenHeader title={t.diaryJournalTitle} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xxl }]} showsVerticalScrollIndicator={false}>
        {showCrisis && (
          <CrisisCard
            onSupport={() => navigation.navigate('Sos')}
            onDismiss={() => setShowCrisis(false)}
          />
        )}

        <View style={styles.metaRow}>
          <View style={styles.flex1}>
            <Text variant="subhead" color={COLORS.secondaryLabel}>
              {dayLabel(dayKey(new Date(entry.createdAt)), t, lang)} · {timeLabel(entry.createdAt, lang)}
            </Text>
            {prompt && (
              <View style={styles.promptTag}>
                <IllusPlaceholder tone={PROMPT_STYLE[prompt.k]?.tone} label={PROMPT_STYLE[prompt.k]?.label} size={20} radius={RADIUS.sm} />
                <Text variant="footnote">{prompt.title}</Text>
              </View>
            )}
          </View>
          {entry.mood != null && <MoodFace level={entry.mood} size={44} />}
        </View>

        {entry.title ? <Text variant="title1" style={styles.title}>{entry.title}</Text> : null}
        {prompt && !entry.title ? <Text variant="title2" color={COLORS.secondaryLabel} style={styles.question}>{prompt.question}</Text> : null}
        <Text variant="body" style={styles.body} selectable>{entry.body}</Text>

        {edited && (
          <Text variant="caption1" color={COLORS.tertiaryLabel}>
            {fmt(t.diaryEditedAt, {
              date: new Date(entry.updatedAt).toLocaleString(locale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            })}
          </Text>
        )}
        <SyncBadge align="left" style={styles.syncRow} />

        {/* Metadatos de lectura: llenan el espacio con información real en
            vez de dejarlo en blanco (H12). */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text variant="footnote" color={COLORS.secondaryLabel}>{t.diaryWordCount ? fmt(t.diaryWordCount, { n: words }) : words}</Text>
          </View>
          <View style={styles.statBox}>
            <Text variant="footnote" color={COLORS.secondaryLabel}>{fmt(t.diaryReadingTime, { n: readMinutes })}</Text>
          </View>
          <View style={styles.statBox}>
            <Text variant="footnote" color={COLORS.secondaryLabel}>{entry.mood != null ? t.moods[entry.mood] : t.diaryMoodOptional}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            variant="filled"
            onPress={() => navigation.navigate('JournalEditor', { id: entry.id })}
            style={styles.flex1}
          >
            {t.diaryEdit}
          </Button>
          <Button
            variant="tinted"
            onPress={confirmDelete}
            style={[styles.flex1, styles.deleteBtn]}
            textStyle={styles.deleteBtnText}
          >
            {t.diaryDelete}
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xs, gap: SPACING.md },
  flex1: { flex: 1 },
  notFound: { textAlign: 'center', marginTop: SPACING.xxl, paddingHorizontal: SPACING.xl },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  promptTag: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'flex-start',
    backgroundColor: COLORS.accentTint, borderRadius: RADIUS.sm, paddingVertical: 4, paddingLeft: 4, paddingRight: SPACING.sm, marginTop: SPACING.xs,
  },
  title: { lineHeight: 30 },
  question: { lineHeight: 26 },
  body: { lineHeight: 25 },
  syncRow: { marginTop: SPACING.xs },
  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  statBox: {
    flex: 1, alignItems: 'center', backgroundColor: COLORS.fill,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm,
  },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  deleteBtn: { backgroundColor: COLORS.tones.rose.bg },
  deleteBtnText: { color: COLORS.destructive },
});
