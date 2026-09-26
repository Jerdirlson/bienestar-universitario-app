import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RaizMark from '../components/RaizMark';
import UpbWordmark from '../components/UpbWordmark';
import { useApp } from '../context/AppContext';
import { decideSplashRoute } from '../lib/onboarding';
import { COLORS, FONTS } from '../theme';

// Tiempo mínimo en pantalla: la animación del logo alcanza a verse aunque la
// sesión se lea del disco en milisegundos.
const MIN_SPLASH_MS = 2200;

export default function SplashScreen({ navigation }) {
  const { t, sessionReady, sessionToken, sessionExpired, onboardingDone } = useApp();
  const [minElapsed, setMinElapsed] = useState(false);
  const scale = useRef(new Animated.Value(0.85)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.85, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    const timer = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

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
    <LinearGradient colors={['#F0E9FF', '#FFE5EB']} style={styles.container}>
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <RaizMark size={140} />
        </Animated.View>
        <Text style={styles.appName}>Raíz</Text>
        <Text style={styles.sub}>
          {t.splashTagline}
        </Text>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.initiativeLabel}>
          {t.splashInitiative}
        </Text>
        <UpbWordmark size={22} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 16 },
  appName: {
    fontFamily: 'Nunito_900Black', fontSize: 44,
    color: COLORS.ink, letterSpacing: -1,
  },
  sub: {
    fontFamily: FONTS.uiRegular, fontSize: 13,
    color: COLORS.inkSoft,
  },
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', gap: 8,
  },
  initiativeLabel: {
    fontFamily: FONTS.uiSemiBold, fontSize: 10,
    color: COLORS.inkMuted, letterSpacing: 2,
  },
});
