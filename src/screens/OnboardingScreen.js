import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect, Line, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import UpbWordmark from '../components/UpbWordmark';
import PrimaryButton from '../components/PrimaryButton';
import { useApp } from '../context/AppContext';
import { COLORS, FONTS, RADIUS } from '../theme';

function IllusMind() {
  return (
    <Svg viewBox="0 0 160 160" width="160" height="160">
      <Circle cx="120" cy="44" r="18" fill="#FFD84D" />
      <G stroke="#FFD84D" strokeWidth="2.5" strokeLinecap="round">
        <Line x1="120" y1="18" x2="120" y2="8" />
        <Line x1="144" y1="26" x2="152" y2="18" />
        <Line x1="150" y1="44" x2="158" y2="44" />
        <Line x1="144" y1="62" x2="152" y2="70" />
        <Line x1="96" y1="26" x2="88" y2="18" />
      </G>
      <Path d="M0 130 Q 40 100 80 120 Q 120 140 160 115 L 160 160 L 0 160 Z" fill="#AD3DFF" fillOpacity="0.35" />
      <Path d="M0 140 Q 50 120 100 138 Q 130 148 160 138 L 160 160 L 0 160 Z" fill="#7A3FF0" fillOpacity="0.55" />
      <Circle cx="62" cy="92" r="10" fill="#FF003D" />
      <Path d="M50 130 Q 50 110 62 108 Q 74 110 74 130 Z" fill="#FF003D" />
      <Circle cx="88" cy="88" r="11" fill="#7A3FF0" />
      <Path d="M74 130 Q 74 106 88 104 Q 102 106 102 130 Z" fill="#7A3FF0" />
      <Path d="M75 96 C 72 93, 68 94, 68 98 C 68 102, 75 106, 75 106 C 75 106, 82 102, 82 98 C 82 94, 78 93, 75 96 Z" fill="#fff" />
    </Svg>
  );
}

function IllusLock() {
  return (
    <Svg viewBox="0 0 120 120" width="140" height="140">
      <Rect x="30" y="54" width="60" height="50" rx="8" fill="#7A3FF0" />
      <Path d="M42 54 V40 a18 18 0 0 1 36 0 V54" fill="none" stroke="#7A3FF0" strokeWidth="7" strokeLinecap="round" />
      <Circle cx="60" cy="76" r="6" fill="#fff" />
      <Rect x="58" y="78" width="4" height="12" fill="#fff" />
      <Circle cx="24" cy="30" r="4" fill="#FF003D" />
      <Circle cx="96" cy="34" r="3" fill="#AD3DFF" />
      <Circle cx="100" cy="90" r="3" fill="#FF003D" />
    </Svg>
  );
}

function IllusHeart() {
  return (
    <Svg viewBox="0 0 120 120" width="140" height="140">
      <Path d="M60 96 C 28 76, 20 54, 30 40 Q 48 28, 60 44 Q 72 28, 90 40 C 100 54, 92 76, 60 96z" fill="#FF003D" />
      <Path d="M44 56 Q50 52 54 56 M66 56 Q70 52 76 56" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Path d="M48 66 Q60 74 72 66" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

const ILLUS_COMPONENTS = [IllusMind, IllusLock, IllusHeart];

export default function OnboardingScreen({ navigation, route }) {
  const step = route.params?.step ?? 0;
  const { t } = useApp();
  const insets = useSafeAreaInsets();
  const isLast = step === 2;

  const slides = [
    { title: t.welcomeTitle, body: t.welcomeBody },
    { title: t.privacyTitle, body: t.privacyBody },
    { title: t.supportTitle, body: t.supportBody },
  ];

  const slide = slides[step];
  const IllusComp = ILLUS_COMPONENTS[step];

  const handleNext = () => {
    if (isLast) navigation.replace('Login');
    else navigation.push('Onboarding', { step: step + 1 });

  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <UpbWordmark size={18} />
        <TouchableOpacity onPress={() => navigation.replace('Login')}>
          <Text style={styles.skipText}>{t.skip}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <LinearGradient colors={['#F0E9FF', '#FFE5EB']} style={styles.illusCircle}>
          <IllusComp />
        </LinearGradient>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.dots}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.cta}>
        <PrimaryButton onPress={handleNext}>
          {isLast ? t.start : t.next}
        </PrimaryButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  skipText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.inkSoft },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, textAlign: 'center',
  },
  illusCircle: {
    width: 220, height: 220, borderRadius: 110,
    alignItems: 'center', justifyContent: 'center', marginBottom: 36,
  },
  title: {
    fontFamily: 'Nunito_900Black', fontSize: 26,
    color: COLORS.ink, lineHeight: 32, marginBottom: 14, textAlign: 'center',
  },
  body: {
    fontFamily: FONTS.uiRegular, fontSize: 15,
    color: COLORS.inkSoft, lineHeight: 22, textAlign: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E6E2F0' },
  dotActive: { width: 24, backgroundColor: COLORS.primary },
  cta: { paddingHorizontal: 24 },
});
