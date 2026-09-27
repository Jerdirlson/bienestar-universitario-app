import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, ScrollView, Animated, StyleSheet, Linking, AccessibilityInfo } from 'react-native';
import ScreenHeader from '../components/wellness/ScreenHeader';
import { useApp } from '../context/AppContext';
import { CRISIS_RESOURCES } from '../data/crisisResources';
import { Screen, Text, Card } from '../ui';
import { COLORS, SPACING, RADIUS } from '../theme';
import { showAlert } from '../components/dialogs';

// La fase se guarda por clave y se traduce al mostrarla: cambiar de idioma a
// mitad de la respiración no deja la palabra anterior en pantalla.
const PHASE_KEY = { inhale: 'sosInhale', hold: 'sosHold', exhale: 'sosExhale' };

// Sin i18n cargado (nunca debería pasar) igual se muestra el número: es lo
// único que no puede faltar en este aviso.
const fmtNumber = (template, number) =>
  (typeof template === 'string' && template.includes('{number}') ? template.replace('{number}', number) : number);

// Presentación rediseñada al estilo Apple (clara, seria, botones grandes);
// la lógica de abajo —qué botón hace qué, qué pasa si falla el marcador, qué
// recursos existen— es exactamente la misma que antes. CLAUDE.md: "El SOS
// siempre funciona" no se toca.
export default function SosScreen({ navigation }) {
  const { t, lang } = useApp();
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('');
  const [seconds, setSeconds] = useState(0);
  const animScale = useRef(new Animated.Value(0.7)).current;
  const animRef = useRef(null);
  const timerRef = useRef(null);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotionRef.current = v; });
  }, []);

  useEffect(() => {
    if (running) {
      if (!reduceMotionRef.current) {
        animRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(animScale, { toValue: 1, duration: 4000, useNativeDriver: true }),
            Animated.timing(animScale, { toValue: 1, duration: 7000, useNativeDriver: true }),
            Animated.timing(animScale, { toValue: 0.7, duration: 8000, useNativeDriver: true }),
          ])
        );
        animRef.current.start();
      }

      timerRef.current = setInterval(() => {
        setSeconds(s => {
          const next = s + 1;
          const mod = next % 19;
          if (mod < 4) setPhase('inhale');
          else if (mod < 11) setPhase('hold');
          else setPhase('exhale');
          return next;
        });
      }, 1000);
      // Sin esto el círculo queda sin texto el primer segundo.
      setPhase('inhale');
    } else {
      animRef.current?.stop();
      Animated.spring(animScale, { toValue: 0.7, useNativeDriver: true }).start();
      clearInterval(timerRef.current);
      setSeconds(0);
    }
    return () => {
      animRef.current?.stop();
      clearInterval(timerRef.current);
    };
  }, [running]);

  // Si abrir el marcador o WhatsApp falla, mostramos el número para que la
  // persona lo pueda marcar a mano. Nunca dejar el toque sin respuesta.
  const openResource = async (r) => {
    const copy = r[lang];
    const url = r.kind === 'tel' ? `tel:${r.target}` : `https://wa.me/${r.target}`;
    try {
      await Linking.openURL(url);
    } catch {
      showAlert(
        copy.title,
        fmtNumber(t.sosOpenFailed, r.display)
      );
    }
  };

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScreenHeader title={t.sos} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Encabezado: claro y serio, sin degradado — la calma viene del
            espacio y la tipografía, no de un color decorativo. */}
        <View style={styles.headerCard}>
          <Text variant="title2" style={styles.headerTitle}>{t.sosTitle}</Text>
          <Text variant="body" color={COLORS.secondaryLabel} style={styles.headerSub}>{t.sosSub}</Text>
        </View>

        {/* Recursos — van primero: en crisis, el contacto pesa más que el ejercicio */}
        {CRISIS_RESOURCES.map((r) => {
          const tone = COLORS.tones[r.tone];
          const copy = r[lang];
          const pending = r.kind === 'pending';
          return (
            <View key={r.id} style={[styles.resource, { backgroundColor: tone.bg }]}>
              <View style={styles.resourceIcon}>
                <Text style={{ fontSize: 20 }}>{r.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="headline" style={{ color: tone.ink }}>{copy.title}</Text>
                <Text variant="footnote" style={{ color: tone.ink, opacity: 0.75 }}>{copy.sub}</Text>
              </View>
              <TouchableOpacity
                onPress={pending ? undefined : () => openResource(r)}
                disabled={pending}
                accessibilityRole="button"
                accessibilityState={{ disabled: pending }}
                accessibilityLabel={`${copy.action} · ${copy.title}`}
                style={[styles.resourceBtn, pending && styles.resourceBtnDisabled]}
                hitSlop={8}
              >
                <Text
                  variant="subhead"
                  style={[{ color: tone.ink }, pending && styles.resourceBtnTextDisabled]}
                >
                  {copy.action}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <Text variant="footnote" color={COLORS.tertiaryLabel} style={styles.disclaimer}>
          {t.sosDisclaimer}
        </Text>

        {/* Widget de respiración */}
        <Card style={styles.breatheCard}>
          <Text variant="title3">{t.breathe}</Text>
          <Text variant="footnote" color={COLORS.secondaryLabel} style={{ marginTop: SPACING.xs }}>{t.breatheInstr}</Text>
          <View style={styles.breatheCircleWrap}>
            <Animated.View style={[styles.breatheCircle, { transform: [{ scale: animScale }] }]} />
            <Text variant="title2" color={COLORS.accent}>
              {running ? (t[PHASE_KEY[phase]] ?? '') : t.sosBreatheIdle}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setRunning(r => !r)}
            accessibilityRole="button"
            accessibilityLabel={running ? t.stop : t.startBreath}
            style={[styles.breatheBtn, running && styles.breatheBtnStop]}
          >
            <Text variant="headline" style={running ? styles.breatheBtnTextStop : styles.breatheBtnText}>
              {running ? t.stop : t.startBreath}
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: 40, gap: SPACING.md },
  headerCard: { paddingHorizontal: SPACING.xs, paddingBottom: SPACING.xs },
  headerTitle: { color: COLORS.label },
  headerSub: { marginTop: SPACING.sm },
  breatheCard: { alignItems: 'center' },
  breatheCircleWrap: {
    width: 160, height: 160, alignItems: 'center', justifyContent: 'center',
    marginVertical: SPACING.xl,
  },
  breatheCircle: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: COLORS.accentTint,
  },
  breatheBtn: {
    backgroundColor: COLORS.accent, borderRadius: RADIUS.pill,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl, minHeight: 48, justifyContent: 'center',
  },
  breatheBtnStop: { backgroundColor: COLORS.fill },
  breatheBtnText: { color: '#fff' },
  breatheBtnTextStop: { color: COLORS.label },
  resource: {
    borderRadius: RADIUS.xl, padding: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
  },
  resourceIcon: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  resourceBtn: {
    backgroundColor: '#fff', borderRadius: RADIUS.pill,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, minHeight: 44, justifyContent: 'center',
  },
  resourceBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.45)' },
  resourceBtnTextDisabled: { opacity: 0.5 },
  disclaimer: {
    textAlign: 'center', paddingHorizontal: SPACING.md, marginTop: 2,
  },
});
