import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, StyleSheet, Linking, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import TopBar from '../components/TopBar';
import { useApp } from '../context/AppContext';
import { CRISIS_RESOURCES } from '../data/crisisResources';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';

export default function SosScreen({ navigation }) {
  const { t, lang } = useApp();
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('');
  const [seconds, setSeconds] = useState(0);
  const animScale = useRef(new Animated.Value(0.7)).current;
  const animRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (running) {
      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(animScale, { toValue: 1, duration: 4000, useNativeDriver: true }),
          Animated.timing(animScale, { toValue: 1, duration: 7000, useNativeDriver: true }),
          Animated.timing(animScale, { toValue: 0.7, duration: 8000, useNativeDriver: true }),
        ])
      );
      animRef.current.start();

      timerRef.current = setInterval(() => {
        setSeconds(s => {
          const next = s + 1;
          const mod = next % 19;
          if (mod < 4) setPhase(lang === 'es' ? 'Inhala' : 'Inhale');
          else if (mod < 11) setPhase(lang === 'es' ? 'Sostén' : 'Hold');
          else setPhase(lang === 'es' ? 'Exhala' : 'Exhale');
          return next;
        });
      }, 1000);
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
  }, [running, lang]);

  // Si abrir el marcador o WhatsApp falla, mostramos el número para que la
  // persona lo pueda marcar a mano. Nunca dejar el toque sin respuesta.
  const openResource = async (r) => {
    const copy = r[lang];
    const url = r.kind === 'tel' ? `tel:${r.target}` : `https://wa.me/${r.target}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        copy.title,
        lang === 'es'
          ? `No pudimos abrirlo automáticamente. Comunícate directamente al ${r.display}.`
          : `We couldn't open it automatically. Reach them directly at ${r.display}.`
      );
    }
  };

  return (
    <View style={styles.container}>
      <TopBar title={t.sos} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header card */}
        <LinearGradient
          colors={['#F7E1E4', '#FCF1E7']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerCard}
        >
          <Text style={styles.headerTitle}>{t.sosTitle}</Text>
          <Text style={styles.headerSub}>{t.sosSub}</Text>
        </LinearGradient>

        {/* Resources — van primero: en crisis, el contacto pesa más que el ejercicio */}
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
                <Text style={[styles.resourceTitle, { color: tone.ink }]}>{copy.title}</Text>
                <Text style={[styles.resourceSub, { color: tone.ink }]}>{copy.sub}</Text>
              </View>
              <TouchableOpacity
                onPress={pending ? undefined : () => openResource(r)}
                disabled={pending}
                accessibilityRole="button"
                accessibilityState={{ disabled: pending }}
                accessibilityLabel={`${copy.action} · ${copy.title}`}
                style={[styles.resourceBtn, pending && styles.resourceBtnDisabled]}
              >
                <Text
                  style={[
                    styles.resourceBtnText,
                    { color: tone.ink },
                    pending && styles.resourceBtnTextDisabled,
                  ]}
                >
                  {copy.action}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <Text style={styles.disclaimer}>
          {lang === 'es'
            ? 'Raíz no es un servicio de emergencias y no reemplaza atención profesional.'
            : 'Raíz is not an emergency service and does not replace professional care.'}
        </Text>

        {/* Breathing widget */}
        <View style={styles.breatheCard}>
          <Text style={styles.breatheTitle}>{t.breathe}</Text>
          <Text style={styles.breatheInstr}>{t.breatheInstr}</Text>
          <View style={styles.breatheCircleWrap}>
            <Animated.View style={[styles.breatheCircle, { transform: [{ scale: animScale }] }]} />
            <Text style={styles.breatheLabel}>
              {running ? phase : (lang === 'es' ? 'Empezar' : 'Start')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setRunning(r => !r)}
            accessibilityRole="button"
            accessibilityLabel={running ? t.stop : t.startBreath}
            style={[styles.breatheBtn, running && styles.breatheBtnStop]}
          >
            <Text style={[styles.breatheBtnText, running && styles.breatheBtnTextStop]}>
              {running ? t.stop : t.startBreath}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  headerCard: { borderRadius: 22, padding: 20 },
  headerTitle: { fontFamily: FONTS.extraBold, fontSize: 22, color: COLORS.ink, lineHeight: 28 },
  headerSub: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.inkSoft, marginTop: 8, lineHeight: 20 },
  breatheCard: {
    backgroundColor: COLORS.bgCard, borderRadius: 22, padding: 24,
    alignItems: 'center', ...SHADOW,
  },
  breatheTitle: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.ink },
  breatheInstr: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, marginTop: 4 },
  breatheCircleWrap: {
    width: 160, height: 160, alignItems: 'center', justifyContent: 'center',
    marginVertical: 20,
  },
  breatheCircle: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: '#DDD3FF',
  },
  breatheLabel: { fontFamily: FONTS.extraBold, fontSize: 20, color: COLORS.primary },
  breatheBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.pill,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  breatheBtnStop: { backgroundColor: '#EEEBF5' },
  breatheBtnText: { fontFamily: FONTS.extraBold, fontSize: 13, color: '#fff', letterSpacing: 0.6, textTransform: 'uppercase' },
  breatheBtnTextStop: { color: COLORS.ink },
  resource: {
    borderRadius: 18, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  resourceIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  resourceTitle: { fontFamily: FONTS.extraBold, fontSize: 15 },
  resourceSub: { fontFamily: FONTS.uiRegular, fontSize: 12, opacity: 0.7, marginTop: 2 },
  resourceBtn: {
    backgroundColor: '#fff', borderRadius: RADIUS.pill,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  resourceBtnText: { fontFamily: FONTS.extraBold, fontSize: 12 },
  resourceBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.45)' },
  resourceBtnTextDisabled: { opacity: 0.5 },
  disclaimer: {
    fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted,
    textAlign: 'center', lineHeight: 16, paddingHorizontal: 12, marginTop: 2,
  },
});
