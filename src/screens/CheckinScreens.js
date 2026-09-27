import React, { useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MoodFace from '../components/MoodFace';
import IllusPlaceholder from '../components/IllusPlaceholder';
import ArticleCard from '../components/ArticleCard';
import { useApp } from '../context/AppContext';
import { COLORS, SPACING, RADIUS } from '../theme';
import { Screen, Text, Button, Chip, Icon, haptics } from '../ui';
import { TextArea } from '../ui/TextField';
import { NOTE_MAX } from '../data/entry';
import { dayKey } from '../lib/dates';
import { hasCrisisSignals } from '../lib/crisisSignals';
import { orderFeelings } from '../lib/feelings';
import { CrisisCard, SyncBadge, fmt, locale, routeExists } from './journal/diaryUi';
import { showAlert } from '../components/dialogs';
import { exitCheckin, withReturn } from '../lib/checkinFlow';

const TOTAL_STEPS = 4;
const HEADER_SIDE = 44;

/**
 * Cabecera común de los 4 pasos del check-in: "atrás" (salvo en el primero),
 * el paso actual y "cerrar". H7 de la auditoría: el contador mostraba "/5"
 * pero solo hay 4 pantallas de contenido antes del resumen — ahora dice lo
 * que de verdad hay, "/4".
 */
function CheckinHeader({ step, onClose, onBack }) {
  const { t } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View style={[ciStyles.header, { paddingTop: insets.top + SPACING.sm }]}>
      <View style={ciStyles.headerSide}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={8} style={ciStyles.iconBtn} accessibilityRole="button" accessibilityLabel={t.diaryBack}>
            <Icon name="chevron-back" size={26} color={COLORS.label} />
          </Pressable>
        )}
      </View>
      <Text variant="subhead" color={COLORS.secondaryLabel}>{step}/{TOTAL_STEPS}</Text>
      <View style={[ciStyles.headerSide, ciStyles.headerSideRight]}>
        <Pressable onPress={onClose} hitSlop={8} style={ciStyles.iconBtn} accessibilityRole="button" accessibilityLabel={t.socClose}>
          <Icon name="close" size={22} color={COLORS.label} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── CHECKIN 1: MOOD ───────────────────────────────────────────────────────
export function Checkin1Screen({ navigation, route }) {
  const returnTo = route?.params?.returnTo;
  const { t, lang, mood, setMood: saveMood, userName, draftDate, entryForDay } = useApp();
  const initialMood = route.params?.initialMood ?? mood ?? 3;
  const [m, setM] = useState(initialMood);
  // Editando un día pasado, o el de hoy si ya estaba registrado.
  const targetKey = draftDate ?? dayKey(new Date());
  const editing = draftDate !== null || Boolean(entryForDay(targetKey));
  const [yy, mm, dd] = targetKey.split('-').map(Number);
  const targetLabel = new Date(yy, mm - 1, dd).toLocaleDateString(locale(lang), {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const choose = (i) => {
    haptics.selection();
    setM(i);
  };

  return (
    <Screen variant="plain">
      <CheckinHeader step={1} onClose={() => exitCheckin(navigation, returnTo)} />
      <View style={ciStyles.body}>
        <Text variant="headline" color={COLORS.secondaryLabel}>{userName ? `${t.hi}, ${userName}` : t.hi}</Text>
        {editing && (
          <Text variant="subhead" color={COLORS.accent} style={ciStyles.editingText}>
            {fmt(t.diaryEditingDay, { date: targetLabel })}
          </Text>
        )}
        <Text variant="title1" style={ciStyles.questionText}>{t.feelingToday}</Text>
        <View style={ciStyles.bigFace}>
          <MoodFace level={m} size={180} />
        </View>
        <Text variant="title2" color={COLORS.mood[m]}>{t.moods[m]}</Text>
        <View style={ciStyles.spacer} />
        {/* H11: mismo lenguaje visual que el selector de ánimo del diario
            libre — la cara elegida a color, las demás en gris (nunca las 5
            a todo color a la vez, que era como se veía solo aquí). */}
        <View style={ciStyles.moodPicker}>
          {[0, 1, 2, 3, 4].map(i => (
            <Pressable key={i} onPress={() => choose(i)} accessibilityRole="button" accessibilityState={{ selected: i === m }} accessibilityLabel={t.moods[i]}>
              <View style={{ transform: [{ scale: i === m ? 1.1 : 1 }] }}>
                <MoodFace level={i} size={40} bordered={i === m} muted={i !== m} />
              </View>
            </Pressable>
          ))}
        </View>
        <View style={ciStyles.ctaWrap}>
          <Button onPress={() => { saveMood(m); navigation.navigate('Checkin2', withReturn({}, returnTo)); }}>
            {t.moods[m]}
          </Button>
        </View>
      </View>
    </Screen>
  );
}

// ─── CHECKIN 2: FEELINGS ───────────────────────────────────────────────────
export function Checkin2Screen({ navigation, route }) {
  // A dónde volver al cerrar o terminar (ver lib/checkinFlow.js).
  const returnTo = route?.params?.returnTo;
  const { t, mood, feelings: savedFeelings, setFeelings } = useApp();
  const [sel, setSel] = useState(savedFeelings || []);
  const toggle = (f) => setSel(s => s.includes(f) ? s.filter(x => x !== f) : [...s, f]);

  return (
    <Screen variant="plain">
      <CheckinHeader step={2} onBack={() => navigation.goBack()} onClose={() => exitCheckin(navigation, returnTo)} />
      <View style={ciStyles.centerHead}>
        <MoodFace level={mood} size={96} />
        <Text variant="title2" style={ciStyles.centerQuestion}>{t.describe}</Text>
      </View>
      <ScrollView style={ciStyles.flex1} showsVerticalScrollIndicator={false}>
        <View style={ciStyles.chipGrid}>
          {/* Se guarda item.k y se muestra item.label: el histórico no depende
              del idioma ni de cómo esté redactada la etiqueta. */}
          {orderFeelings(t.feelingItems, mood).map(item => (
            <Chip
              key={item.k}
              selected={sel.includes(item.k)}
              onPress={() => toggle(item.k)}
            >
              {item.label}
            </Chip>
          ))}
        </View>
      </ScrollView>
      <View style={ciStyles.ctaWrap}>
        <Button
          disabled={sel.length === 0}
          onPress={() => { setFeelings(sel); navigation.navigate('Checkin3', withReturn({}, returnTo)); }}
        >
          {t.next}
        </Button>
      </View>
    </Screen>
  );
}

// ─── CHECKIN 3: CAUSES ─────────────────────────────────────────────────────
export function Checkin3Screen({ navigation, route }) {
  // A dónde volver al cerrar o terminar (ver lib/checkinFlow.js).
  const returnTo = route?.params?.returnTo;
  const { t, causes: savedCauses, setCauses } = useApp();
  const [sel, setSel] = useState(savedCauses || []);
  const toggle = (k) => {
    haptics.selection();
    setSel(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k]);
  };

  const iconFor = (k) => {
    const map = {
      estudios: { tone: 'sun', label: 'libros' },
      amigos: { tone: 'sky', label: 'amigos' },
      familia: { tone: 'rose', label: 'familia' },
      pareja: { tone: 'blush', label: 'pareja' },
      ejercicio: { tone: 'mint', label: 'deporte' },
      sueno: { tone: 'lilac', label: 'descanso' },
      universidad: { tone: 'sage', label: 'campus' },
      hobbies: { tone: 'peach', label: 'hobby' },
      redes: { tone: 'sky', label: 'redes' },
      comida: { tone: 'peach', label: 'comida' },
      salud: { tone: 'rose', label: 'salud' },
      dinero: { tone: 'mint', label: '$' },
    };
    return map[k] || { tone: 'lilac', label: k };
  };

  return (
    <Screen variant="plain">
      <CheckinHeader step={3} onBack={() => navigation.goBack()} onClose={() => exitCheckin(navigation, returnTo)} />
      <Text variant="title2" style={ciStyles.causesQuestion}>{t.causes}</Text>
      <ScrollView style={ciStyles.flex1} showsVerticalScrollIndicator={false}>
        <View style={ciStyles.causeGrid}>
          {t.causeItems.map(item => {
            const ico = iconFor(item.k);
            const isSel = sel.includes(item.k);
            return (
              <Pressable
                key={item.k}
                onPress={() => toggle(item.k)}
                style={[ciStyles.causeBtn, isSel && ciStyles.causeBtnSel]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={item.label}
              >
                <IllusPlaceholder tone={ico.tone} label={ico.label} size={48} radius={RADIUS.sm} />
                <Text variant="footnote" style={ciStyles.causeBtnText}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={ciStyles.ctaWrap}>
        <Button
          disabled={sel.length === 0}
          onPress={() => { setCauses(sel); navigation.navigate('Checkin4', withReturn({}, returnTo)); }}
        >
          {t.next}
        </Button>
      </View>
    </Screen>
  );
}

// ─── CHECKIN 4: JOURNAL ────────────────────────────────────────────────────
export function Checkin4Screen({ navigation, route }) {
  // A dónde volver al cerrar o terminar (ver lib/checkinFlow.js).
  const returnTo = route?.params?.returnTo;
  const { t, causes, journalText, saveEntry, draftDate, entryForDay } = useApp();
  const [val, setVal] = useState(journalText);
  const [saving, setSaving] = useState(false);
  const highlight = causes?.length ? (t.causeItems.find(c => c.k === causes[0])?.label || '') : '';

  // Solo avanzamos si el check-in quedó guardado: la pantalla siguiente muestra
  // la racha, y enseñar una racha que no se guardó sería mentirle a la persona.
  // Guardar es local e inmediato; la subida a la cuenta va por detrás.
  const finish = async () => {
    if (saving) return;
    setSaving(true);
    const wasEditing = Boolean(entryForDay(draftDate ?? new Date()));
    try {
      const saved = await saveEntry({ note: val });
      // Revisión local, en el teléfono: el texto no sale a ningún lado para esto.
      const crisis = hasCrisisSignals(val);
      haptics.notifySuccess();
      navigation.navigate('Checkin5', withReturn({ crisis, mood: saved.mood, edited: wasEditing }, returnTo));
    } catch {
      showAlert(t.diarySaveErrorTitle, t.diarySaveErrorBody);
    } finally {
      setSaving(false);
    }
  };

  return (
    // §8 (regla dura del teclado): campo y botón "Finalizar" siempre visibles
    // sobre el teclado — `Screen keyboard` ya resuelve iOS/Android.
    <Screen variant="plain" keyboard>
      <CheckinHeader step={4} onBack={() => navigation.goBack()} onClose={() => exitCheckin(navigation, returnTo)} />
      <View style={ciStyles.notePrompt}>
        <Text variant="title2" style={ciStyles.noteQuestion}>
          {t.why} <Text variant="title2" color={COLORS.accent}>{highlight}</Text> {t.makingFeel}
        </Text>
      </View>
      <TextArea
        testID="checkin-note"
        value={val}
        onChangeText={setVal}
        placeholder={t.placeholder}
        maxLength={NOTE_MAX}
        style={ciStyles.textarea}
      />
      <Text variant="caption1" color={COLORS.tertiaryLabel} style={ciStyles.counter}>
        {fmt(t.diaryCounter, { n: val.length, max: NOTE_MAX })}
      </Text>
      <View style={ciStyles.footer}>
        <Button onPress={finish} disabled={saving} loading={saving}>{t.finish}</Button>
      </View>
    </Screen>
  );
}

// ─── CHECKIN 5: STREAK ─────────────────────────────────────────────────────
// Sugerencias según el ánimo que se acaba de registrar: con el ánimo bajo,
// soltar lo que preocupa y bajar el ritmo; con el ánimo alto, afianzar lo bueno.
const PROMPTS_BY_MOOD = [
  ['worry', 'letter'],
  ['worry', 'helped'],
  ['helped', 'free'],
  ['gratitude', 'proud'],
  ['gratitude', 'proud'],
];
const PROMPT_ILLUS = {
  gratitude: { tone: 'sun', label: 'gratitud' },
  worry: { tone: 'lilac', label: 'pensamientos' },
  helped: { tone: 'mint', label: 'positivo' },
  letter: { tone: 'rose', label: 'relaciones' },
  proud: { tone: 'peach', label: 'positivo' },
  free: { tone: 'sky', label: 'diario' },
};

export function Checkin5Screen({ navigation, route }) {
  const { t, streak } = useApp();
  const insets = useSafeAreaInsets();
  // El check-in ya quedó guardado en el paso anterior, así que `streak` ya lo cuenta.
  const { crisis = false, mood = 3, edited = false, returnTo } = route.params ?? {};
  const [showCrisis, setShowCrisis] = useState(true);

  const suggestions = [];
  if (mood <= 2) {
    if (routeExists(navigation, 'Breathing')) {
      suggestions.push({
        key: 'breathing', tone: 'sky', label: 'respirar', title: t.diaryBreathingShort,
        duration: fmt(t.diaryMinutes, { n: 3 }), onPress: () => navigation.navigate('Breathing'),
      });
    }
    if (routeExists(navigation, 'Grounding')) {
      suggestions.push({
        key: 'grounding', tone: 'mint', label: 'mindful', title: t.diaryGroundingShort,
        duration: fmt(t.diaryMinutes, { n: 5 }), onPress: () => navigation.navigate('Grounding'),
      });
    }
  }
  for (const k of PROMPTS_BY_MOOD[mood] ?? PROMPTS_BY_MOOD[3]) {
    const p = t.diaryPrompts.find(x => x.k === k);
    if (!p) continue;
    suggestions.push({
      key: k, ...PROMPT_ILLUS[k], title: p.title, duration: fmt(t.diaryMinutes, { n: 5 }),
      onPress: () => navigation.navigate('JournalEditor', { promptKey: k }),
    });
  }

  return (
    <ScrollView
      style={ci5Styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[ci5Styles.hero, { paddingTop: insets.top + SPACING.xl }]}>
        <Pressable
          onPress={() => exitCheckin(navigation, returnTo)}
          accessibilityRole="button"
          accessibilityLabel={t.socClose}
          hitSlop={8}
          style={ci5Styles.closeBtn}
        >
          <Icon name="close-circle" size={28} color={COLORS.tertiaryLabel} />
        </Pressable>

        <Icon name="flame" size={72} color={COLORS.tones.peach.ink} />
        <Text variant="title2" style={ci5Styles.streakNum}>
          {streak} {streak === 1 ? t.dayStreak : t.dayStreakShort}
        </Text>
        <Text variant="subhead" color={COLORS.secondaryLabel} style={ci5Styles.streakSub}>
          {edited ? t.diaryChangesSaved : t.keepTracking}
        </Text>
        <SyncBadge style={ci5Styles.syncBadge} />
      </View>

      {crisis && showCrisis && (
        <View style={ci5Styles.crisisWrap}>
          <CrisisCard
            onSupport={() => navigation.navigate('Sos')}
            onDismiss={() => setShowCrisis(false)}
          />
        </View>
      )}

      <View style={ci5Styles.suggestionsWrap}>
        <Text variant="title2">{t.justForYou}</Text>
        <Text variant="subhead" color={COLORS.secondaryLabel} style={ci5Styles.mtXs}>{t.basedOnFeelings}</Text>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={ci5Styles.suggestionsScroll}
          contentContainerStyle={ci5Styles.suggestionsContent}
        >
          {suggestions.map(s => (
            <ArticleCard
              key={s.key}
              tone={s.tone}
              label={s.label}
              title={s.title}
              duration={s.duration}
              onPress={s.onPress}
            />
          ))}
        </ScrollView>
      </View>

      <View style={ci5Styles.exploreWrap}>
        <Button onPress={() => { navigation.popToTop(); navigation.navigate('explore'); }}>
          {t.exploreMore}
        </Button>
      </View>
    </ScrollView>
  );
}

const ciStyles = StyleSheet.create({
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingBottom: SPACING.xs,
  },
  headerSide: { width: HEADER_SIDE, alignItems: 'flex-start' },
  headerSideRight: { alignItems: 'flex-end' },
  iconBtn: { width: HEADER_SIDE, height: HEADER_SIDE, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  editingText: { marginTop: SPACING.xs, marginBottom: SPACING.xs },
  questionText: { textAlign: 'center', marginTop: SPACING.xs },
  bigFace: { marginVertical: SPACING.xxl },
  spacer: { flex: 1 },
  moodPicker: { flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.xl },
  ctaWrap: { paddingHorizontal: SPACING.xs, paddingBottom: SPACING.sm, width: '100%' },
  centerHead: { alignItems: 'center', padding: SPACING.xl },
  centerQuestion: { marginTop: SPACING.md, textAlign: 'center' },
  chipGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg,
  },
  causesQuestion: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg, textAlign: 'center' },
  causeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg,
  },
  causeBtn: {
    width: '30%', padding: SPACING.md, backgroundColor: COLORS.fill,
    borderRadius: RADIUS.lg, alignItems: 'center', gap: SPACING.sm,
  },
  causeBtnSel: {
    backgroundColor: COLORS.accentTint,
    borderWidth: 2, borderColor: COLORS.accent,
  },
  causeBtnText: { textAlign: 'center' },
  notePrompt: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  noteQuestion: { textAlign: 'left' },
  textarea: {
    flex: 1, backgroundColor: 'transparent', paddingHorizontal: SPACING.xl, paddingTop: SPACING.xs,
    lineHeight: 24, borderRadius: 0, minHeight: 0,
    // En web, un TextInput enfocado dibuja el contorno de foco del navegador
    // (un recuadro negro grueso) porque nada en el sistema de diseño lo
    // desactiva todavía — se apaga aquí en vez de tocar src/ui/TextField.js.
    outlineStyle: 'none',
  },
  counter: { textAlign: 'right', paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xs },
  footer: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md, paddingTop: SPACING.xs },
});

const ci5Styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bgPlain },
  hero: {
    backgroundColor: COLORS.accentTint,
    padding: SPACING.xl, alignItems: 'center', paddingBottom: SPACING.xxl,
  },
  closeBtn: { position: 'absolute', right: SPACING.md, top: SPACING.md },
  streakNum: { marginTop: SPACING.md, textAlign: 'center' },
  streakSub: { marginTop: SPACING.sm, textAlign: 'center', maxWidth: 280 },
  syncBadge: { marginTop: SPACING.md },
  crisisWrap: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  suggestionsWrap: { padding: SPACING.lg },
  mtXs: { marginTop: SPACING.xs },
  suggestionsScroll: { marginTop: SPACING.lg, marginHorizontal: -SPACING.lg },
  suggestionsContent: { paddingLeft: SPACING.lg, gap: SPACING.md, paddingRight: SPACING.lg },
  exploreWrap: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },
});
