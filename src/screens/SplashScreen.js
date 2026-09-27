import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RaizMark from '../components/RaizMark';
import UpbWordmark from '../components/UpbWordmark';
import { Text } from '../ui';
import { useApp } from '../context/AppContext';
import { decideSplashRoute } from '../lib/onboarding';
import { COLORS, SPACING } from '../theme';

// Tiempo mínimo en pantalla: la animación del logo alcanza a verse aunque la
// sesión se lea del disco en milisegundos.
const MIN_SPLASH_MS = 2200;

export default function SplashScreen({ navigation }) {
  const { t, sessionReady, sessionToken, sessionExpired, onboardingDone } = useApp();
  const [minElapsed, setMinElapsed] = useState(false);
  const scale = useRef(new Animated.Value(0.85)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cancelled = false;
    // §7 del sistema de diseño: sin animaciones decorativas si la persona
    // pidió "reducir movimiento" — el logo se queda quieto en su tamaño final.
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) { scale.setValue(1); return; }
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.85, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    });

    const timer = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [scale]);

  // Con sesión guardada se entra directo. Antes siempre iba al onboarding y
  // al login: recargar o reabrir la app obligaba a iniciar sesión de nuevo
  // aunque el token siguiera vigente. Se espera a sessionReady para no
  // decidir antes de haber leído el almacenamiento (onboardingDone se lee en
  // el mismo arranque, ver AppContext.js). decideSplashRoute (src/lib/
  // onboarding.js) es pura y se prueba aparte: quien ya vio el onboarding
  // una vez no vuelve a verlo, salvo que nunca tuviera sesión ni lo completara.
  useEffect(() => {
    if (!minElapsed || !sessionReady) return;
    const route = decideSplashRoute({ sessionToken, sessionExpired, onboardingDone });
    navigation.replace(route.name, route.params);
  }, [minElapsed, sessionReady, sessionToken, sessionExpired, onboardingDone, navigation]);

  return (
    // Fondo plano en vez del degradado rosa/lila anterior: §1 del sistema de
    // diseño pide "deferencia" (el cromo se retira) y nada de degradados
    // decorativos fuera de ilustraciones puntuales — un launch screen de
    // Apple es casi siempre un color plano y el logo, nada más.
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <RaizMark size={140} />
        </Animated.View>
        <Text variant="largeTitle" style={styles.appName}>Raíz</Text>
        <Text variant="subhead" color={COLORS.secondaryLabel}>{t.splashTagline}</Text>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + SPACING.xxl }]}>
        <Text variant="caption2" style={styles.initiativeLabel}>{t.splashInitiative}</Text>
        <UpbWordmark size={22} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgPlain },
  center: { alignItems: 'center', gap: SPACING.md },
  appName: { color: COLORS.label, letterSpacing: -0.5 },
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', gap: SPACING.sm,
  },
  initiativeLabel: { color: COLORS.tertiaryLabel, letterSpacing: 2 },
});
