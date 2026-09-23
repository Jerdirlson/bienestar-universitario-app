import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../../components/TopBar';
import MoodFace from '../../components/MoodFace';
import IllusPlaceholder from '../../components/IllusPlaceholder';
import { useApp } from '../../context/AppContext';
import { dayKey } from '../../lib/dates';
import { COLORS, FONTS, RADIUS } from '../../theme';
import { CrisisCard, PROMPT_STYLE, SyncBadge, dayLabel, fmt, locale, promptFor, timeLabel } from './diaryUi';

/** Una entrada del diario libre. params: { id, crisis? } */
export default function JournalEntryScreen({ navigation, route }) {
  const { id, crisis } = route.params ?? {};
  const { t, lang, journalById, deleteJournal } = useApp();
  const insets = useSafeAreaInsets();
  const [showCrisis, setShowCrisis] = useState(Boolean(crisis));
  const entry = id ? journalById(id) : null;

  if (!entry) {
    return (
      <View style={styles.container}>
        <TopBar title={t.diaryJournalTitle} onBack={() => navigation.goBack()} right={<View style={{ width: 36 }} />} />
        <Text style={styles.notFound}>{t.diaryEntryNotFound}</Text>
      </View>
    );
  }

  const prompt = promptFor(t, entry.promptKey);
  const edited = Date.parse(entry.updatedAt) - Date.parse(entry.createdAt) > 60 * 1000;

  const confirmDelete = () => {
    Alert.alert(t.diaryDeleteTitle, t.diaryDeleteBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.diaryDelete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteJournal(entry.id);
            navigation.goBack();
          } catch {
            Alert.alert(t.diarySaveErrorTitle, t.diaryDeleteError);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <TopBar title={t.diaryJournalTitle} onBack={() => navigation.goBack()} right={<View style={{ width: 36 }} />} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        {showCrisis && (
          <CrisisCard
            onSupport={() => navigation.navigate('Sos')}
            onDismiss={() => setShowCrisis(false)}
          />
        )}

        <View style={styles.metaRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.date}>
              {dayLabel(dayKey(new Date(entry.createdAt)), t, lang)} · {timeLabel(entry.createdAt, lang)}
            </Text>
            {prompt && (
              <View style={styles.promptTag}>
                <IllusPlaceholder tone={PROMPT_STYLE[prompt.k]?.tone} label={PROMPT_STYLE[prompt.k]?.label} size={22} radius={6} />
                <Text style={styles.promptTagText}>{prompt.title}</Text>
              </View>
            )}
          </View>
          {entry.mood != null && <MoodFace level={entry.mood} size={44} />}
        </View>

        {entry.title ? <Text style={styles.title}>{entry.title}</Text> : null}
        {prompt && !entry.title ? <Text style={styles.question}>{prompt.question}</Text> : null}
        <Text style={styles.body} selectable>{entry.body}</Text>

        {edited && (
          <Text style={styles.edited}>
            {fmt(t.diaryEditedAt, {
              date: new Date(entry.updatedAt).toLocaleString(locale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            })}
          </Text>
        )}
        <SyncBadge align="left" style={{ marginTop: 4 }} />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => navigation.navigate('JournalEditor', { id: entry.id })}
            accessibilityRole="button"
          >
            <Text style={styles.btnPrimaryText}>{t.diaryEdit}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={confirmDelete} accessibilityRole="button">
            <Text style={styles.btnDangerText}>{t.diaryDelete}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 20, paddingTop: 4, gap: 14 },
  notFound: { fontFamily: FONTS.uiRegular, fontSize: 15, color: COLORS.inkSoft, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  date: { fontFamily: FONTS.uiSemiBold, fontSize: 13, color: COLORS.inkSoft },
  promptTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: '#F2EFFA', borderRadius: 10, paddingVertical: 4, paddingLeft: 4, paddingRight: 10, marginTop: 8,
  },
  promptTagText: { fontFamily: FONTS.bold, fontSize: 12, color: COLORS.ink },
  title: { fontFamily: FONTS.extraBold, fontSize: 24, color: COLORS.ink, lineHeight: 30 },
  question: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.inkSoft, lineHeight: 24 },
  body: { fontFamily: FONTS.uiRegular, fontSize: 16, color: COLORS.ink, lineHeight: 25 },
  edited: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn: { flex: 1, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center' },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnPrimaryText: { fontFamily: FONTS.extraBold, fontSize: 14, color: '#fff', letterSpacing: 0.4 },
  btnDanger: { backgroundColor: '#FDECEE' },
  btnDangerText: { fontFamily: FONTS.extraBold, fontSize: 14, color: '#D93B4A', letterSpacing: 0.4 },
});
