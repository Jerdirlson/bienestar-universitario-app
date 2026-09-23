import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import TopBar from '../components/TopBar';
import PrimaryButton from '../components/PrimaryButton';
import { useApp } from '../context/AppContext';
import {
  TECHNIQUES, DURATIONS, getTechnique, sessionLengthMs, phaseAt, phaseTargetScale,
} from '../data/breathing';
import { exerciseLog, creditBreathingChallenge } from '../data/wellnessStore';
import { fmt } from '../i18n/wellness';
import { COLORS, FONTS, SHADOW } from '../theme';

const MIN_SCALE = 0.5;
const MAX_SCALE = 1;
const TICK_MS = 100;

const TECH_COPY = {
  slow: { name: 'wlTechSlowName', desc: 'wlTechSlowDesc' },
  box: { name: 'wlTechBoxName', desc: 'wlTechBoxDesc' },
  '478': { name: 'wlTech478Name', desc: 'wlTech478Desc' },
};
const PHASE_COPY = { inhale: 'wlPhaseInhale', hold: 'wlPhaseHold', exhale: 'wlPhaseExhale', holdOut: 'wlPhaseHoldOut' };

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function BreathingScreen({ navigation }) {
  const { t, lang, sessionToken, apiVersion } = useApp();
  const [techId, setTechId] = useState('slow');
  const [minutes, setMinutes] = useState(3);
  // 'setup' | 'running' | 'paused' | 'done'
  const [status, setStatus] = useState('setup');
  const [phase, setPhase] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [credited, setCredited] = useState(null);

  const technique = getTechnique(techId);
  const totalMs = sessionLengthMs(technique, minutes);

  const scale = useRef(new Animated.Value(MIN_SCALE)).current;
  const accRef = useRef(0);
  const startedAtRef = useRef(null);
  const lastPhaseRef = useRef(null);
  const intervalRef = useRef(null);
  const aliveRef = useRef(true);

  const clearTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  useEffect(() => () => {
    aliveRef.current = false;
    clearTimer();
    scale.stopAnimation();
  }, [scale]);

  const finish = useCallback(async () => {
    clearTimer();
    startedAtRef.current = null;
    setStatus('done');
    Animated.timing(scale, { toValue: MIN_SCALE, duration: 600, useNativeDriver: true }).start();
    try {
      await exerciseLog.record({ kind: 'breathing', technique: technique.id, seconds: totalMs / 1000 });
    } catch { /* sin almacenamiento: el ejercicio se hizo igual */ }
    const c = await creditBreathingChallenge({ token: sessionToken, apiVersion, lang });
    if (aliveRef.current && c) setCredited(c);
  }, [scale, technique.id, totalMs, sessionToken, apiVersion, lang]);

  const tick = useCallback(() => {
    if (startedAtRef.current == null) return;
    const now = Date.now();
    const el = accRef.current + (now - startedAtRef.current);
    const p = phaseAt(technique, el, totalMs);
    if (p.done) { setElapsed(totalMs); finish(); return; }
    const key = `${p.cycle}-${p.index}`;
    if (key !== lastPhaseRef.current) {
      lastPhaseRef.current = key;
      const target = phaseTargetScale(p.kind, { min: MIN_SCALE, max: MAX_SCALE });
      if (target !== null) {
        Animated.timing(scale, {
          toValue: target,
          duration: p.remainingMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }).start();
      }
    }
    setPhase(p);
    setElapsed(el);
  }, [technique, totalMs, scale, finish]);

  const runTimer = () => {
    clearTimer();
    intervalRef.current = setInterval(tick, TICK_MS);
    tick();
  };

  // tick cambia si cambia la técnica; mientras corre no se puede cambiar, pero
  // mantenemos el intervalo apuntando a la versión vigente.
  useEffect(() => {
    if (status === 'running') {
      clearTimer();
      intervalRef.current = setInterval(tick, TICK_MS);
    }
  }, [tick, status]);

  const start = () => {
    scale.stopAnimation();
    scale.setValue(MIN_SCALE);
    accRef.current = 0;
    startedAtRef.current = Date.now();
    lastPhaseRef.current = null;
    setCredited(null);
    setElapsed(0);
    setStatus('running');
    runTimer();
  };

  const pause = () => {
    if (startedAtRef.current != null) accRef.current += Date.now() - startedAtRef.current;
    startedAtRef.current = null;
    clearTimer();
    scale.stopAnimation();
    setStatus('paused');
  };

  const resume = () => {
    startedAtRef.current = Date.now();
    lastPhaseRef.current = null; // re-anima la fase actual con el tiempo que le queda
    setStatus('running');
    runTimer();
  };

  const end = () => {
    clearTimer();
    startedAtRef.current = null;
    scale.stopAnimation();
    scale.setValue(MIN_SCALE);
    setPhase(null);
    setStatus('setup');
  };

  const inSession = status === 'running' || status === 'paused';

  return (
    <View style={styles.container}>
      <TopBar title={t.wlBreathingTitle} onBack={() => navigation.goBack()} right={<View />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {status === 'setup' && (
          <>
            <Text style={styles.label}>{t.wlChooseTechnique}</Text>
            {TECHNIQUES.map(tech => {
              const selected = tech.id === techId;
              return (
                <TouchableOpacity
                  key={tech.id}
                  onPress={() => setTechId(tech.id)}
                  activeOpacity={0.8}
                  style={[styles.techCard, selected && styles.techCardSelected]}
                >
                  <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.techName}>{t[TECH_COPY[tech.id].name]}</Text>
                    <Text style={styles.techDesc}>{t[TECH_COPY[tech.id].desc]}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={[styles.label, { marginTop: 8 }]}>{t.wlChooseDuration}</Text>
            <View style={styles.durations}>
              {DURATIONS.map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMinutes(m)}
                  style={[styles.durationChip, m === minutes && styles.durationChipOn]}
                >
                  <Text style={[styles.durationText, m === minutes && styles.durationTextOn]}>{fmt(t.wlMinutes, { n: m })}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.warning}>
              <Text style={styles.warningText}>{t.wlDizzyWarning}</Text>
            </View>

            <PrimaryButton onPress={start}>{t.wlStartSession}</PrimaryButton>
          </>
        )}

        {status !== 'setup' && (
          <View style={styles.stage}>
            <View style={styles.circleWrap}>
              <View style={styles.circleGuide} />
              <Animated.View style={[styles.circle, { transform: [{ scale }] }]} />
              <View style={styles.circleCenter} pointerEvents="none">
                {inSession && phase && (
                  <>
                    <Text style={styles.phaseText}>{status === 'paused' ? t.wlPaused : t[PHASE_COPY[phase.kind]]}</Text>
                    {status === 'running' && <Text style={styles.phaseCount}>{Math.ceil(phase.remainingMs / 1000)}</Text>}
                  </>
                )}
                {status === 'done' && <Text style={styles.phaseText}>✓</Text>}
              </View>
            </View>

            {inSession && (
              <>
                <Text style={styles.timeLeft}>{fmt(t.wlTimeLeft, { time: mmss(totalMs - elapsed) })}</Text>
                <Text style={styles.techSmall}>{t[TECH_COPY[technique.id].name]}</Text>
                <View style={styles.controls}>
                  <TouchableOpacity onPress={status === 'running' ? pause : resume} style={styles.controlBtn}>
                    <Text style={styles.controlText}>{status === 'running' ? t.wlPause : t.wlResume}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={end} style={[styles.controlBtn, styles.controlGhost]}>
                    <Text style={[styles.controlText, styles.controlGhostText]}>{t.wlEndSession}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.warningInline}>{t.wlDizzyWarning}</Text>
              </>
            )}

            {status === 'done' && (
              <View style={styles.doneBox}>
                <Text style={styles.doneTitle}>{t.wlSessionDone}</Text>
                <Text style={styles.doneBody}>{t.wlSessionDoneBody}</Text>
                {credited && (
                  <Text style={styles.credited}>
                    {fmt(t.wlChallengeCredited, { done: credited.completed_days, total: credited.total_days })}
                  </Text>
                )}
                <PrimaryButton onPress={start} style={{ marginTop: 8 }}>{t.wlAgain}</PrimaryButton>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
                  <Text style={styles.backLinkText}>{t.wlBack}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const CIRCLE = 240;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 60, gap: 12 },
  label: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.ink },
  techCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: COLORS.bgCard, borderRadius: 18, padding: 16,
    borderWidth: 2, borderColor: 'transparent', ...SHADOW,
  },
  techCardSelected: { borderColor: COLORS.primary },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#C9C3DB',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioOn: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  techName: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink },
  techDesc: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, lineHeight: 17, marginTop: 4 },
  durations: { flexDirection: 'row', gap: 10 },
  durationChip: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: '#F2EFFA', alignItems: 'center' },
  durationChipOn: { backgroundColor: COLORS.primary },
  durationText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.ink },
  durationTextOn: { color: '#fff' },
  warning: { backgroundColor: COLORS.tones.peach.bg, borderRadius: 14, padding: 14, marginVertical: 4 },
  warningText: { fontFamily: FONTS.uiMedium, fontSize: 12, color: COLORS.tones.peach.ink, lineHeight: 17 },
  stage: { alignItems: 'center', gap: 14, paddingTop: 12 },
  circleWrap: { width: CIRCLE, height: CIRCLE, alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  circleGuide: {
    position: 'absolute', width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2,
    borderWidth: 2, borderColor: COLORS.primarySoft,
  },
  circle: {
    position: 'absolute', width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2,
    backgroundColor: COLORS.tones.lilac.bg,
  },
  circleCenter: { alignItems: 'center', justifyContent: 'center' },
  phaseText: { fontFamily: FONTS.extraBold, fontSize: 24, color: COLORS.tones.lilac.ink },
  phaseCount: { fontFamily: FONTS.black, fontSize: 40, color: COLORS.primary, marginTop: 4 },
  timeLeft: { fontFamily: FONTS.uiSemiBold, fontSize: 14, color: COLORS.inkSoft },
  techSmall: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkMuted, marginTop: -8 },
  controls: { flexDirection: 'row', gap: 12, marginTop: 6 },
  controlBtn: { backgroundColor: COLORS.primary, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24 },
  controlText: { fontFamily: FONTS.extraBold, fontSize: 14, color: '#fff' },
  controlGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary },
  controlGhostText: { color: COLORS.primary },
  warningInline: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted, textAlign: 'center', lineHeight: 16, paddingHorizontal: 16 },
  doneBox: { width: '100%', alignItems: 'center', gap: 8 },
  doneTitle: { fontFamily: FONTS.extraBold, fontSize: 22, color: COLORS.ink },
  doneBody: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft, textAlign: 'center' },
  credited: {
    fontFamily: FONTS.uiSemiBold, fontSize: 13, color: COLORS.primaryDeep, textAlign: 'center',
    backgroundColor: COLORS.primarySoft, borderRadius: 12, padding: 12, alignSelf: 'stretch',
  },
  backLink: { paddingVertical: 10 },
  backLinkText: { fontFamily: FONTS.uiSemiBold, fontSize: 14, color: COLORS.primary },
});
