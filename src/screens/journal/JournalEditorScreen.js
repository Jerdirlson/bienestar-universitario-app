import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MoodFace from '../../components/MoodFace';
import { useApp } from '../../context/AppContext';
import { JOURNAL_BODY_MAX, JOURNAL_TITLE_MAX } from '../../data/journal';
import { hasCrisisSignals } from '../../lib/crisisSignals';
import { COLORS, SPACING, RADIUS } from '../../theme';
import { Screen, Text, Button, Chip, haptics } from '../../ui';
import { TextField, TextArea } from '../../ui/TextField';
import { ScreenHeader, fmt, promptFor } from './diaryUi';

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
    // H8 de la auditoría: al elegir activamente otra guía, el aviso de
    // "recuperamos tu borrador" (que hablaba de la guía anterior) deja de
    // mostrarse — ya no describe lo que hay en pantalla ahora.
    setRestored(false);
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
      haptics.notifySuccess();
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
      <Screen variant="plain" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t.diaryEditorEdit} onBack={() => navigation.goBack()} />
        <Text variant="callout" color={COLORS.secondaryLabel} style={styles.notFound}>{t.diaryEntryNotFound}</Text>
      </Screen>
    );
  }

  const over = body.length > JOURNAL_BODY_MAX;
  // A qué guía pertenece el borrador recuperado, si a alguna (H8).
  const restoredPrompt = restored ? promptFor(t, initial.promptKey) : null;

  return (
    // §8 (regla dura del teclado): el cuerpo y "Guardar" siempre visibles
    // sobre el teclado.
    <Screen variant="plain" edges={['top', 'left', 'right']} keyboard>
      <ScreenHeader title={existing ? t.diaryEditorEdit : t.diaryEditorNew} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {restored && (
          <View style={styles.banner}>
            <Text variant="subhead" color={COLORS.primaryDeep} style={styles.flex1}>
              {restoredPrompt ? fmt(t.diaryDraftRestoredPrompt, { prompt: restoredPrompt.title }) : t.diaryDraftRestored}
            </Text>
            <Button variant="plain" onPress={discardDraft} haptic={false}>{t.diaryDiscardDraft}</Button>
          </View>
        )}

        <View style={styles.promptsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promptsContent}
            keyboardShouldPersistTaps="handled"
          >
            {t.diaryPrompts.map((p) => (
              <Chip key={p.k} selected={promptKey === p.k} onPress={() => choosePrompt(p.k)}>
                {p.title}
              </Chip>
            ))}
          </ScrollView>
          {/* H9: misma pista de desplazamiento que la lista del diario. */}
          <LinearGradient
            pointerEvents="none"
            colors={[`${COLORS.bgPlain}00`, COLORS.bgPlain]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.promptsFade}
          />
        </View>

        {prompt && <Text variant="title2" style={styles.question}>{prompt.question}</Text>}

        <TextField
          testID="journal-title"
          value={title}
          onChangeText={setTitle}
          placeholder={t.diaryTitlePlaceholder}
          maxLength={JOURNAL_TITLE_MAX}
          style={styles.titleInput}
          accessibilityLabel={t.diaryTitlePlaceholder}
        />
        <TextArea
          testID="journal-body"
          value={body}
          onChangeText={(v) => { setBody(v); if (error) setError(null); }}
          placeholder={t.diaryBodyPlaceholder}
          maxLength={JOURNAL_BODY_MAX}
          style={styles.bodyInput}
          minHeight={220}
          autoFocus={!existing && !initial.restored}
          accessibilityLabel={t.diaryBodyPlaceholder}
        />
        <View style={styles.metaRow}>
          <Text variant="caption1" color={COLORS.tertiaryLabel}>{draftSaved && dirty ? t.diaryDraftSaved : ' '}</Text>
          <Text variant="caption1" color={over ? COLORS.destructive : COLORS.tertiaryLabel}>
            {fmt(t.diaryCounter, { n: body.length, max: JOURNAL_BODY_MAX })}
          </Text>
        </View>
        {error && <Text variant="subhead" color={COLORS.destructive}>{error}</Text>}

        <Text variant="headline" style={styles.moodTitle}>{t.diaryMoodOptional}</Text>
        <View style={styles.moodRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Pressable
              key={i}
              onPress={() => { haptics.selection(); setMood(mood === i ? null : i); }}
              accessibilityRole="button"
              accessibilityState={{ selected: mood === i }}
              accessibilityLabel={t.moods[i]}
            >
              <View style={{ transform: [{ scale: mood === i ? 1.1 : 1 }] }}>
                <MoodFace level={i} size={40} bordered={mood === i} muted={mood !== null && mood !== i} />
              </View>
            </Pressable>
          ))}
          {mood !== null && (
            <Button variant="plain" onPress={() => setMood(null)} haptic={false}>{t.diaryMoodClear}</Button>
          )}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <Button onPress={save} disabled={saving} loading={saving}>{t.save}</Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.lg },
  flex1: { flex: 1 },
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm,
    backgroundColor: COLORS.accentTint, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  promptsRow: { marginHorizontal: -SPACING.lg },
  promptsContent: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  promptsFade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 28 },
  question: { marginTop: SPACING.xs },
  titleInput: {
    backgroundColor: 'transparent', paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.separator, borderRadius: 0,
    // Ver el comentario homólogo en CheckinScreens.js: apaga el contorno de
    // foco negro que dibuja el navegador en web.
    outlineStyle: 'none',
  },
  bodyInput: { backgroundColor: 'transparent', paddingHorizontal: 0, borderRadius: 0, outlineStyle: 'none' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moodTitle: { marginTop: SPACING.sm },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flexWrap: 'wrap' },
  footer: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm, backgroundColor: COLORS.bgPlain },
  notFound: { textAlign: 'center', marginTop: SPACING.xxl, paddingHorizontal: SPACING.xl },
});
