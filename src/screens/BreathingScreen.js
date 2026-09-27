import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Animated, Easing, AccessibilityInfo } from 'react-native';
import ScreenHeader from '../components/wellness/ScreenHeader';
import { useApp } from '../context/AppContext';
import {
  TECHNIQUES, DURATIONS, getTechnique, sessionLengthMs, phaseAt, phaseTargetScale,
} from '../data/breathing';
import { exerciseLog, creditBreathingChallenge } from '../data/wellnessStore';
import { fmt } from '../i18n/wellness';
import { Screen, Text, Card, Button } from '../ui';
import { COLORS, SPACING, RADIUS } from '../theme';

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
  const reduceMotionRef = useRef(false);

  const technique = getTechnique(techId);
  const totalMs = sessionLengthMs(technique, minutes);

  const scale = useRef(new Animated.Value(MIN_SCALE)).current;
  const accRef = useRef(0);
  const startedAtRef = useRef(null);
  const lastPhaseRef = useRef(null);
  const intervalRef = useRef(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotionRef.current = v; });
  }, []);

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
      // §7: sin la animación de "respirar" del círculo si se pidió reducir
      // movimiento — el texto de la fase (Inhala/Sostén/Exhala) sigue siendo
      // la guía, sin depender del movimiento para entenderla.
      if (target !== null && !reduceMotionRef.current) {
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
    <Screen edges={['left', 'right', 'bottom']}>
      <ScreenHeader title={t.wlBreathingTitle} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {status === 'setup' && (
          <>
            <Text variant="title2">{t.wlChooseTechnique}</Text>
            {TECHNIQUES.map(tech => {
              const selected = tech.id === techId;
              return (
                <TouchableOpacity
                  key={tech.id}
                  onPress={() => setTechId(tech.id)}
                  activeOpacity={0.8}
                >
                  <Card style={[styles.techCard, selected && styles.techCardSelected]}>
                    <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
                    <View style={{ flex: 1 }}>
                      <Text variant="headline">{t[TECH_COPY[tech.id].name]}</Text>
                      <Text variant="footnote" color={COLORS.secondaryLabel} style={{ marginTop: 4 }}>{t[TECH_COPY[tech.id].desc]}</Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}

            <Text variant="title2" style={{ marginTop: SPACING.xs }}>{t.wlChooseDuration}</Text>
            <View style={styles.durations}>
              {DURATIONS.map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMinutes(m)}
                  style={[styles.durationChip, m === minutes && styles.durationChipOn]}
                >
                  <Text variant="headline" style={m === minutes ? styles.durationTextOn : styles.durationText}>
                    {fmt(t.wlMinutes, { n: m })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.warning}>
              <Text variant="footnote" color={COLORS.tones.peach.ink}>{t.wlDizzyWarning}</Text>
            </View>

            <Button onPress={start}>{t.wlStartSession}</Button>
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
                    <Text variant="title2" style={styles.phaseText}>{status === 'paused' ? t.wlPaused : t[PHASE_COPY[phase.kind]]}</Text>
                    {status === 'running' && <Text variant="largeTitle" color={COLORS.accent} style={styles.phaseCount}>{Math.ceil(phase.remainingMs / 1000)}</Text>}
                  </>
                )}
                {status === 'done' && <Text variant="title1" style={styles.phaseText}>✓</Text>}
              </View>
            </View>

            {inSession && (
              <>
                <Text variant="subhead" color={COLORS.secondaryLabel}>{fmt(t.wlTimeLeft, { time: mmss(totalMs - elapsed) })}</Text>
                <Text variant="footnote" color={COLORS.tertiaryLabel} style={{ marginTop: -8 }}>{t[TECH_COPY[technique.id].name]}</Text>
                <View style={styles.controls}>
                  <TouchableOpacity onPress={status === 'running' ? pause : resume} style={styles.controlBtn}>
                    <Text variant="headline" style={styles.controlText}>{status === 'running' ? t.wlPause : t.wlResume}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={end} style={[styles.controlBtn, styles.controlGhost]}>
                    <Text variant="headline" color={COLORS.accent}>{t.wlEndSession}</Text>
                  </TouchableOpacity>
                </View>
                <Text variant="caption1" color={COLORS.tertiaryLabel} style={styles.warningInline}>{t.wlDizzyWarning}</Text>
              </>
            )}

            {status === 'done' && (
              <View style={styles.doneBox}>
                <Text variant="title2">{t.wlSessionDone}</Text>
                <Text variant="subhead" color={COLORS.secondaryLabel} style={{ textAlign: 'center' }}>{t.wlSessionDoneBody}</Text>
                {credited && (
                  <View style={styles.credited}>
                    <Text variant="subhead" color={COLORS.primaryDeep} style={{ textAlign: 'center' }}>
                      {fmt(t.wlChallengeCredited, { done: credited.completed_days, total: credited.total_days })}
                    </Text>
                  </View>
                )}
                <Button onPress={start} style={{ marginTop: SPACING.sm }}>{t.wlAgain}</Button>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
                  <Text variant="subhead" color={COLORS.accent}>{t.wlBack}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const CIRCLE = 240;

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: 60, gap: SPACING.md },
  techCard: {
    flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start',
    borderWidth: 2, borderColor: 'transparent',
  },
  techCardSelected: { borderColor: COLORS.accent },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.separator,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioOn: { borderColor: COLORS.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent },
  durations: { flexDirection: 'row', gap: SPACING.sm },
  durationChip: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.fill, alignItems: 'center' },
  durationChipOn: { backgroundColor: COLORS.accent },
  durationText: { color: COLORS.label },
  durationTextOn: { color: '#fff' },
  warning: { backgroundColor: COLORS.tones.peach.bg, borderRadius: RADIUS.md, padding: SPACING.md, marginVertical: SPACING.xs },
  stage: { alignItems: 'center', gap: SPACING.md, paddingTop: SPACING.sm },
  circleWrap: { width: CIRCLE, height: CIRCLE, alignItems: 'center', justifyContent: 'center', marginVertical: SPACING.md },
  circleGuide: {
    position: 'absolute', width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2,
    borderWidth: 2, borderColor: COLORS.accentTint,
  },
  circle: {
    position: 'absolute', width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2,
    backgroundColor: COLORS.tones.lilac.bg,
  },
  circleCenter: { alignItems: 'center', justifyContent: 'center' },
  phaseText: { color: COLORS.tones.lilac.ink },
  phaseCount: { marginTop: 4 },
  controls: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xs },
  controlBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.pill, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl },
  controlText: { color: '#fff' },
  controlGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.accent },
  warningInline: { textAlign: 'center', paddingHorizontal: SPACING.lg },
  doneBox: { width: '100%', alignItems: 'center', gap: SPACING.sm },
  credited: {
    backgroundColor: COLORS.accentTint, borderRadius: RADIUS.md, padding: SPACING.md, alignSelf: 'stretch',
  },
  backLink: { paddingVertical: SPACING.sm },
});
