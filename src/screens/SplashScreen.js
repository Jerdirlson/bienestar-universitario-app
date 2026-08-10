import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RaizMark from '../components/RaizMark';
import UpbWordmark from '../components/UpbWordmark';
import { useApp } from '../context/AppContext';
import { COLORS, FONTS } from '../theme';

export default function SplashScreen({ navigation }) {
  const { lang } = useApp();
  const scale = useRef(new Animated.Value(0.85)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.85, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    const timer = setTimeout(() => navigation.replace('Onboarding'), 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient colors={['#F0E9FF', '#FFE5EB']} style={styles.container}>
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <RaizMark size={140} />
        </Animated.View>
        <Text style={styles.appName}>Raíz</Text>
        <Text style={styles.sub}>
          {lang === 'es' ? 'Bienestar mental universitario' : 'Student mental wellness'}
        </Text>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.initiativeLabel}>
          {lang === 'es' ? 'UNA INICIATIVA DE' : 'AN INITIATIVE OF'}
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
