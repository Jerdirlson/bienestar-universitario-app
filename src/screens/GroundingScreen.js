import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import TopBar from '../components/TopBar';
import PrimaryButton from '../components/PrimaryButton';
import ProgressSegments from '../components/wellness/ProgressSegments';
import { useApp } from '../context/AppContext';
import { exerciseLog } from '../data/wellnessStore';
import { fmt } from '../i18n/wellness';
import { COLORS, FONTS } from '../theme';

// 5-4-3-2-1: ver, tocar, oír, oler, saborear.
const STEPS = [
  { count: 5, title: 'wlGroundStep5', hint: 'wlGroundStep5Hint', tone: 'lilac', icon: '👀' },
  { count: 4, title: 'wlGroundStep4', hint: 'wlGroundStep4Hint', tone: 'mint', icon: '✋' },
  { count: 3, title: 'wlGroundStep3', hint: 'wlGroundStep3Hint', tone: 'sky', icon: '👂' },
  { count: 2, title: 'wlGroundStep2', hint: 'wlGroundStep2Hint', tone: 'peach', icon: '👃' },
  { count: 1, title: 'wlGroundStep1', hint: 'wlGroundStep1Hint', tone: 'sun', icon: '👅' },
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

  return (
    <View style={styles.container}>
      <TopBar title={t.wlGroundingTitle} onBack={() => navigation.goBack()} right={<View />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === -1 && (
          <View style={styles.center}>
            <Text style={styles.bigTitle}>{t.wlGroundingTitle}</Text>
            <Text style={styles.body}>{t.wlGroundingIntro}</Text>
            <PrimaryButton onPress={begin} style={{ marginTop: 12 }}>{t.start}</PrimaryButton>
          </View>
        )}

        {current && (
          <View style={styles.center}>
            <View style={{ alignSelf: 'stretch' }}>
              <ProgressSegments done={step + 1} total={STEPS.length} height={6} />
            </View>
            <Text style={styles.stepOf}>{fmt(t.wlStepOf, { n: step + 1, total: STEPS.length })}</Text>
            <View style={[styles.bubble, { backgroundColor: COLORS.tones[current.tone].bg }]}>
              <Text style={styles.bubbleIcon}>{current.icon}</Text>
              <Text style={[styles.bubbleCount, { color: COLORS.tones[current.tone].ink }]}>{current.count}</Text>
            </View>
            <Text style={styles.stepTitle}>{t[current.title]}</Text>
            <Text style={styles.body}>{t[current.hint]}</Text>

            <View style={styles.dots}>
              {Array.from({ length: current.count }).map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setMarked(i < marked ? i : i + 1)}
                  style={[styles.dot, i < marked && styles.dotOn]}
                  accessibilityRole="button"
                  accessibilityLabel={`${i + 1}`}
                >
                  {i < marked && <Text style={styles.dotCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.tapHint}>{t.wlGroundTapHint}</Text>

            <PrimaryButton onPress={next} style={{ marginTop: 8 }}>
              {step === STEPS.length - 1 ? t.finish : t.next}
            </PrimaryButton>
          </View>
        )}

        {step === STEPS.length && (
          <View style={styles.center}>
            <View style={[styles.bubble, { backgroundColor: COLORS.primarySoft }]}>
              <Text style={[styles.bubbleCount, { color: COLORS.primary }]}>✓</Text>
            </View>
            <Text style={styles.stepTitle}>{t.wlGroundDone}</Text>
            <Text style={styles.body}>{t.wlGroundDoneBody}</Text>
            <PrimaryButton onPress={begin} style={{ marginTop: 8 }}>{t.wlAgain}</PrimaryButton>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.link}>
              <Text style={styles.linkText}>{t.wlBack}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={() => navigation.navigate('Sos')} style={styles.crisis}>
          <Text style={styles.crisisText}>{t.wlCrisisHint}</Text>
          <Text style={styles.crisisLink}>{t.wlGoToSos} →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 60, gap: 16 },
  center: { alignItems: 'center', gap: 12 },
  bigTitle: { fontFamily: FONTS.black, fontSize: 32, color: COLORS.primary, marginTop: 24 },
  body: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.inkSoft, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  stepOf: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.inkMuted },
  bubble: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  bubbleIcon: { fontSize: 28 },
  bubbleCount: { fontFamily: FONTS.black, fontSize: 48 },
  stepTitle: { fontFamily: FONTS.extraBold, fontSize: 22, color: COLORS.ink, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  dot: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#C9C3DB',
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgCard,
  },
  dotOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dotCheck: { fontFamily: FONTS.black, fontSize: 18, color: '#fff' },
  tapHint: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted },
  link: { paddingVertical: 10 },
  linkText: { fontFamily: FONTS.uiSemiBold, fontSize: 14, color: COLORS.primary },
  crisis: { backgroundColor: COLORS.tones.rose.bg, borderRadius: 16, padding: 14, gap: 4, marginTop: 12 },
  crisisText: { fontFamily: FONTS.uiMedium, fontSize: 12, color: COLORS.tones.rose.ink },
  crisisLink: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.tones.rose.ink },
});
