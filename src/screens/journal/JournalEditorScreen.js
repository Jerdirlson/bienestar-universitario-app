import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../../components/TopBar';
import MoodFace from '../../components/MoodFace';
import Chip from '../../components/Chip';
import PrimaryButton from '../../components/PrimaryButton';
import { useApp } from '../../context/AppContext';
import { JOURNAL_BODY_MAX, JOURNAL_TITLE_MAX } from '../../data/journal';
import { hasCrisisSignals } from '../../lib/crisisSignals';
import { COLORS, FONTS } from '../../theme';
import { fmt, promptFor } from './diaryUi';

const AUTOSAVE_MS = 700;

/**
 * Editor del diario libre. params: { id?, promptKey? }
 *  - con id: edita esa entrada
 *  - sin id: entrada nueva, opcionalmente con un prompt guiado
 * El borrador se guarda solo en el teléfono mientras se escribe, y se
 * recupera si la persona sale sin guardar.
 */
export default function JournalEditorScreen({ navigation, route }) {
  const { id, promptKey: initialPrompt } = route.params ?? {};
  const { t, journalById, saveJournal, getJournalDraft, setJournalDraft } = useApp();
  const insets = useSafeAreaInsets();

  const existing = id ? journalById(id) : null;
  const draftKey = id ? `edit:${String(id).toLowerCase()}` : `new:${initialPrompt ?? 'free'}`;

  // Punto de partida sin borrador: la entrada existente o una hoja en blanco
  // (con la plantilla del prompt, p. ej. "1. 2. 3." para gratitud).
  const baseline = useMemo(() => {
    if (existing) {
      return { title: existing.title, body: existing.body, promptKey: existing.promptKey, mood: existing.mood };
    }
    const p = promptFor(t, initialPrompt);
    return { title: '', body: p?.template ?? '', promptKey: initialPrompt ?? null, mood: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [initial] = useState(() => {
    const d = getJournalDraft(draftKey);
    return d ? { ...baseline, ...d, restored: true } : { ...baseline, restored: false };
  });
  const [title, setTitle] = useState(initial.title ?? '');
  const [body, setBody] = useState(initial.body ?? '');
  const [promptKey, setPromptKey] = useState(initial.promptKey ?? null);
  const [mood, setMood] = useState(initial.mood ?? null);
  const [restored, setRestored] = useState(initial.restored);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);

  const prompt = promptFor(t, promptKey);
  const dirty = title !== baseline.title || body !== baseline.body
    || promptKey !== baseline.promptKey || mood !== baseline.mood;

  // Autoguardado del borrador (solo local; nunca se sube).
  const latest = useRef({ title, body, promptKey, mood, dirty });
  latest.current = { title, body, promptKey, mood, dirty };
  useEffect(() => {
    if (savedRef.current) return undefined;
    setDraftSaved(false);
    const timer = setTimeout(() => {
      if (savedRef.current) return;
      if (dirty) {
        setJournalDraft(draftKey, { title, body, promptKey, mood }).then(() => setDraftSaved(true)).catch(() => {});
      } else {
        setJournalDraft(draftKey, null).catch(() => {});
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [title, body, promptKey, mood, dirty, draftKey, setJournalDraft]);

  // Al salir sin guardar, el borrador se escribe de inmediato (sin esperar el temporizador).
  useEffect(() => () => {
    const l = latest.current;
    if (!savedRef.current && l.dirty) {
      setJournalDraft(draftKey, { title: l.title, body: l.body, promptKey: l.promptKey, mood: l.mood }).catch(() => {});
    }
  }, [draftKey, setJournalDraft]);

  const discardDraft = () => {
    setTitle(baseline.title);
    setBody(baseline.body);
    setPromptKey(baseline.promptKey);
    setMood(baseline.mood);
    setRestored(false);
    setJournalDraft(draftKey, null).catch(() => {});
  };

  const choosePrompt = (k) => {
    const next = promptKey === k ? null : k;
    setPromptKey(next);
    // Si la hoja está vacía (o solo tiene la plantilla anterior), usa la nueva plantilla.
    const oldTemplate = prompt?.template ?? '';
    if (!body.trim() || body === oldTemplate) setBody(promptFor(t, next)?.template ?? '');
  };

  const save = async () => {
    if (saving) return;
    const template = prompt?.template ?? '';
    if (!body.trim() || body.trim() === template.trim()) { setError(t.diaryBodyRequired); return; }
    if (body.length > JOURNAL_BODY_MAX) { setError(fmt(t.diaryTooLong, { max: JOURNAL_BODY_MAX })); return; }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveJournal({ id: existing?.id, title, body, promptKey, mood });
      savedRef.current = true;
      await setJournalDraft(draftKey, null).catch(() => {});
      // Revisión local, en el teléfono: nada del texto sale para esto.
      const crisis = hasCrisisSignals(title, body);
      // Editando, el editor se abrió desde el detalle de esa misma entrada:
      // popTo vuelve a ese detalle. Con replace quedaban dos detalles
      // apilados y "Volver" llevaba a la misma entrada en vez de a la lista.
      if (existing) navigation.popTo('JournalEntry', { id: saved.id, crisis });
      else navigation.replace('JournalEntry', { id: saved.id, crisis });
    } catch {
      setError(t.diarySaveErrorBody);
      setSaving(false);
    }
  };

  if (id && !existing && !initial.restored) {
    return (
      <View style={styles.container}>
        <TopBar title={t.diaryEditorEdit} onBack={() => navigation.goBack()} right={<View style={{ width: 36 }} />} />
        <Text style={styles.notFound}>{t.diaryEntryNotFound}</Text>
      </View>
    );
  }

  const over = body.length > JOURNAL_BODY_MAX;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TopBar
        title={existing ? t.diaryEditorEdit : t.diaryEditorNew}
        onBack={() => navigation.goBack()}
        right={<View style={{ width: 36 }} />}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {restored && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{t.diaryDraftRestored}</Text>
            <TouchableOpacity onPress={discardDraft} accessibilityRole="button">
              <Text style={styles.bannerAction}>{t.diaryDiscardDraft}</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -16 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {t.diaryPrompts.map((p) => (
            <Chip key={p.k} selected={promptKey === p.k} onPress={() => choosePrompt(p.k)} style={styles.chip}>
              {p.title}
            </Chip>
          ))}
        </ScrollView>

        {prompt && <Text style={styles.question}>{prompt.question}</Text>}

        <TextInput
          testID="journal-title"
          value={title}
          onChangeText={setTitle}
          placeholder={t.diaryTitlePlaceholder}
          placeholderTextColor={COLORS.inkMuted}
          maxLength={JOURNAL_TITLE_MAX}
          style={styles.titleInput}
          accessibilityLabel={t.diaryTitlePlaceholder}
        />
        <TextInput
          testID="journal-body"
          value={body}
          onChangeText={(v) => { setBody(v); if (error) setError(null); }}
          placeholder={t.diaryBodyPlaceholder}
          placeholderTextColor={COLORS.inkMuted}
          multiline
          maxLength={JOURNAL_BODY_MAX}
          style={styles.bodyInput}
          textAlignVertical="top"
          autoFocus={!existing && !initial.restored}
          accessibilityLabel={t.diaryBodyPlaceholder}
        />
        <View style={styles.metaRow}>
          <Text style={styles.draftText}>{draftSaved && dirty ? t.diaryDraftSaved : ' '}</Text>
          <Text style={[styles.counter, over && { color: '#D93B4A' }]}>
            {fmt(t.diaryCounter, { n: body.length, max: JOURNAL_BODY_MAX })}
          </Text>
        </View>
        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.moodTitle}>{t.diaryMoodOptional}</Text>
        <View style={styles.moodRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setMood(mood === i ? null : i)}
              accessibilityRole="button"
              accessibilityState={{ selected: mood === i }}
              accessibilityLabel={t.moods[i]}
            >
              <View style={{ transform: [{ scale: mood === i ? 1.1 : 1 }] }}>
                <MoodFace level={i} size={40} bordered={mood === i} muted={mood !== null && mood !== i} />
              </View>
            </TouchableOpacity>
          ))}
          {mood !== null && (
            <TouchableOpacity onPress={() => setMood(null)} accessibilityRole="button">
              <Text style={styles.clearMood}>{t.diaryMoodClear}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <PrimaryButton onPress={save} disabled={saving}>{t.save}</PrimaryButton>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 16, gap: 12 },
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primarySoft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14,
  },
  bannerText: { fontFamily: FONTS.uiMedium, fontSize: 13, color: COLORS.primaryDeep },
  bannerAction: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.primary },
  chip: { paddingVertical: 10, paddingHorizontal: 14 },
  question: { fontFamily: FONTS.extraBold, fontSize: 20, color: COLORS.ink, lineHeight: 26, marginTop: 4 },
  titleInput: {
    fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.ink,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.hair,
  },
  bodyInput: {
    minHeight: 220, fontFamily: FONTS.uiRegular, fontSize: 16, color: COLORS.ink,
    lineHeight: 24, paddingTop: 8,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  draftText: { fontFamily: FONTS.uiMedium, fontSize: 11, color: COLORS.inkMuted },
  counter: { fontFamily: FONTS.uiMedium, fontSize: 11, color: COLORS.inkMuted },
  error: { fontFamily: FONTS.uiSemiBold, fontSize: 13, color: '#D93B4A' },
  moodTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink, marginTop: 12 },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  clearMood: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.inkSoft, paddingHorizontal: 6 },
  footer: { paddingHorizontal: 24, paddingTop: 8, backgroundColor: '#fff' },
  notFound: { fontFamily: FONTS.uiRegular, fontSize: 15, color: COLORS.inkSoft, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
});
