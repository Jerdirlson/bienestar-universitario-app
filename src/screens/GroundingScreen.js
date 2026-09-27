import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import ScreenHeader from '../components/wellness/ScreenHeader';
import ProgressSegments from '../components/wellness/ProgressSegments';
import { useApp } from '../context/AppContext';
import { exerciseLog } from '../data/wellnessStore';
import { fmt } from '../i18n/wellness';
import { Screen, Text, Button, Icon } from '../ui';
import { COLORS, SPACING, RADIUS } from '../theme';

// 5-4-3-2-1: ver, tocar, oír, oler, saborear.
const STEPS = [
  { count: 5, title: 'wlGroundStep5', hint: 'wlGroundStep5Hint', tone: 'lilac', icon: 'eye-outline' },
  { count: 4, title: 'wlGroundStep4', hint: 'wlGroundStep4Hint', tone: 'mint', icon: 'hand-left-outline' },
  { count: 3, title: 'wlGroundStep3', hint: 'wlGroundStep3Hint', tone: 'sky', icon: 'ear-outline' },
  { count: 2, title: 'wlGroundStep2', hint: 'wlGroundStep2Hint', tone: 'peach', icon: 'flower-outline' },
  { count: 1, title: 'wlGroundStep1', hint: 'wlGroundStep1Hint', tone: 'sun', icon: 'cafe-outline' },
];

export default function GroundingScreen({ navigation }) {
  const { t } = useApp();
  // -1 = introducción, 0..4 = pasos, 5 = terminado
  const [step, setStep] = useState(-1);
  const [marked, setMarked] = useState(0);
  const [startedAt, setStartedAt] = useState(null);

  const begin = () => { setStep(0); setMarked(0); setStartedAt(Date.now()); };

  const next = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      setMarked(0);
      return;
    }
    setStep(STEPS.length);
    try {
      await exerciseLog.record({
        kind: 'grounding',
        technique: '54321',
        seconds: startedAt ? (Date.now() - startedAt) / 1000 : 0,
      });
    } catch { /* sin almacenamiento: el ejercicio se hizo igual */ }
  };

  const current = STEPS[step];
  // H3 de la auditoría: antes "Siguiente" se podía tocar sin marcar ningún
  // círculo, y el ejercicio perdía el valor de detenerse a notar algo real.
  // Igual que Causas en el check-in, exige al menos un círculo por paso.
  const canAdvance = marked > 0;

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScreenHeader title={t.wlGroundingTitle} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === -1 && (
          <View style={styles.center}>
            <Text variant="largeTitle" color={COLORS.accent} style={styles.bigTitle}>{t.wlGroundingTitle}</Text>
            <Text variant="body" color={COLORS.secondaryLabel} style={styles.body}>{t.wlGroundingIntro}</Text>
            <Button onPress={begin} style={{ marginTop: SPACING.md }}>{t.start}</Button>
          </View>
        )}

        {current && (
          <View style={styles.center}>
            <View style={{ alignSelf: 'stretch' }}>
              <ProgressSegments done={step + 1} total={STEPS.length} height={6} />
            </View>
            <Text variant="footnote" color={COLORS.tertiaryLabel}>{fmt(t.wlStepOf, { n: step + 1, total: STEPS.length })}</Text>
            <View style={[styles.bubble, { backgroundColor: COLORS.tones[current.tone].bg }]}>
              <Icon name={current.icon} size={28} color={COLORS.tones[current.tone].ink} />
              <Text variant="largeTitle" style={[styles.bubbleCount, { color: COLORS.tones[current.tone].ink }]}>{current.count}</Text>
            </View>
            <Text variant="title2" style={styles.stepTitle}>{t[current.title]}</Text>
            <Text variant="body" color={COLORS.secondaryLabel} style={styles.body}>{t[current.hint]}</Text>

            <View style={styles.dots}>
              {Array.from({ length: current.count }).map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setMarked(i < marked ? i : i + 1)}
                  style={[styles.dot, i < marked && styles.dotOn]}
                  accessibilityRole="button"
                  accessibilityLabel={`${i + 1}`}
                  accessibilityState={{ selected: i < marked }}
                >
                  {i < marked && <Icon name="checkmark" size={18} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
            <Text variant="caption1" color={COLORS.tertiaryLabel}>{t.wlGroundTapHint}</Text>

            <Button
              onPress={next}
              disabled={!canAdvance}
              style={{ marginTop: SPACING.sm }}
            >
              {step === STEPS.length - 1 ? t.finish : t.next}
            </Button>
          </View>
        )}

        {step === STEPS.length && (
          <View style={styles.center}>
            <View style={[styles.bubble, { backgroundColor: COLORS.accentTint }]}>
              <Icon name="checkmark" size={40} color={COLORS.accent} />
            </View>
            <Text variant="title2" style={styles.stepTitle}>{t.wlGroundDone}</Text>
            <Text variant="body" color={COLORS.secondaryLabel} style={styles.body}>{t.wlGroundDoneBody}</Text>
            <Button onPress={begin} style={{ marginTop: SPACING.sm }}>{t.wlAgain}</Button>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.link}>
              <Text variant="subhead" color={COLORS.accent}>{t.wlBack}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={() => navigation.navigate('Sos')} style={styles.crisis}>
          <Text variant="footnote" color={COLORS.tones.rose.ink}>{t.wlCrisisHint}</Text>
          <Text variant="headline" color={COLORS.tones.rose.ink}>{t.wlGoToSos} →</Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: 60, gap: SPACING.lg },
  center: { alignItems: 'center', gap: SPACING.md },
  bigTitle: { marginTop: SPACING.xxl },
  body: { textAlign: 'center', lineHeight: 22, paddingHorizontal: SPACING.sm },
  bubble: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center', marginVertical: SPACING.sm, gap: 2 },
  bubbleCount: { marginTop: 2 },
  stepTitle: { textAlign: 'center' },
  dots: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm, flexWrap: 'wrap', justifyContent: 'center' },
  dot: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: COLORS.separator,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgElevated,
  },
  dotOn: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  link: { paddingVertical: SPACING.sm },
  crisis: { backgroundColor: COLORS.tones.rose.bg, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.xs, marginTop: SPACING.md },
});
