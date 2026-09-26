import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import UpbWordmark from '../components/UpbWordmark';
import RaizMark from '../components/RaizMark';
import PrimaryButton from '../components/PrimaryButton';
import MoodFace from '../components/MoodFace';
import IllusPlaceholder from '../components/IllusPlaceholder';
import { useApp } from '../context/AppContext';
import { fmt } from '../i18n/wellness';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';
import { TOTAL_STEPS, FOCUS_OPTIONS, clampStep, isLastStep, progressFor } from '../lib/onboarding';

// ── ilustraciones locales, mismo trazo que traía el onboarding viejo ────────
// (IllusMind/IllusLock/IllusHeart existían antes; IllusChat es nueva, para el
// paso de comunidad, con el mismo estilo de formas simples y paleta UPB.)

function IllusMind() {
  return (
    <Svg viewBox="0 0 160 160" width="150" height="150">
      <Circle cx="120" cy="44" r="18" fill="#FFD84D" />
      <G stroke="#FFD84D" strokeWidth="2.5" strokeLinecap="round">
        <Path d="M120 18 L120 8" />
        <Path d="M144 26 L152 18" />
        <Path d="M150 44 L158 44" />
        <Path d="M144 62 L152 70" />
        <Path d="M96 26 L88 18" />
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

// Las tres reciben `size` (antes venía fijo en el propio SVG) para poder
// hacerlas más protagonistas en heroSmall sin duplicar el dibujo.
function IllusLock({ size = 120 }) {
  return (
    <Svg viewBox="0 0 120 120" width={size} height={size}>
      <Path d="M30 54 h60 a8 8 0 0 1 8 8 v34 a8 8 0 0 1 -8 8 h-60 a8 8 0 0 1 -8 -8 v-34 a8 8 0 0 1 8 -8 Z" fill="#7A3FF0" />
      <Path d="M42 54 V40 a18 18 0 0 1 36 0 V54" fill="none" stroke="#7A3FF0" strokeWidth="7" strokeLinecap="round" />
      <Circle cx="60" cy="76" r="6" fill="#fff" />
      <Path d="M60 80 L60 90" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <Circle cx="24" cy="30" r="4" fill="#FF003D" />
      <Circle cx="96" cy="34" r="3" fill="#AD3DFF" />
      <Circle cx="100" cy="90" r="3" fill="#FF003D" />
    </Svg>
  );
}

function IllusHeart({ size = 120 }) {
  return (
    <Svg viewBox="0 0 120 120" width={size} height={size}>
      <Path d="M60 96 C 28 76, 20 54, 30 40 Q 48 28, 60 44 Q 72 28, 90 40 C 100 54, 92 76, 60 96z" fill="#FF003D" />
      <Path d="M44 56 Q50 52 54 56 M66 56 Q70 52 76 56" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Path d="M48 66 Q60 74 72 66" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function IllusChat({ size = 120 }) {
  return (
    <Svg viewBox="0 0 120 120" width={size} height={size}>
      <Path d="M18 30 h56 a10 10 0 0 1 10 10 v22 a10 10 0 0 1 -10 10 H46 l-16 14 v-14 h-2 a10 10 0 0 1 -10 -10 V40 a10 10 0 0 1 10 -10 Z" fill="#AD3DFF" />
      <Path d="M52 58 h44 a8 8 0 0 1 8 8 v14 a8 8 0 0 1 -8 8 h-2 v10 l-13 -10 H52 a8 8 0 0 1 -8 -8 V66 a8 8 0 0 1 8 -8 Z" fill="#FF003D" />
      <Circle cx="32" cy="50" r="3" fill="#fff" />
      <Circle cx="44" cy="50" r="3" fill="#fff" />
      <Circle cx="56" cy="50" r="3" fill="#fff" />
    </Svg>
  );
}

// Flechita del botón Atrás — un trazo, no un ícono con librerías extra.
function ChevronLeft() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M12.5 4 L7 10 L12.5 16" stroke={COLORS.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// Mapa clave de enfoque → clave de copy (src/i18n/onboarding.js), en el mismo
// orden que FOCUS_OPTIONS (src/lib/onboarding.js), que a su vez son las
// categorías reales de ExploreScreen.js (CATEGORY_ORDER).
const FOCUS_LABEL_KEY = {
  live_well: 'onboardingFocusLiveWell',
  relieve_stress: 'onboardingFocusRelieveStress',
  relations: 'onboardingFocusRelations',
  mindfulness: 'onboardingFocusMindfulness',
};
const FOCUS_TONE = {
  live_well: 'mint',
  relieve_stress: 'peach',
  relations: 'blush',
  mindfulness: 'sky',
};

function Pillar({ label, children }) {
  return (
    <View style={styles.pillar}>
      <View style={styles.pillarIcon}>{children}</View>
      <Text style={styles.pillarLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function OnboardingScreen({ navigation }) {
  const { t, completeOnboarding, onboardingFocus, toggleOnboardingFocus } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [step, setStep] = useState(0);
  // Ánimo elegido solo para la vista previa del paso 2 — no se guarda como
  // check-in real, es una demostración de cómo funciona.
  const [previewMood, setPreviewMood] = useState(null);

  const stepAnim = useRef(new Animated.Value(0)).current; // px de desplazamiento del carrusel
  const enterAnim = useRef(new Animated.Value(1)).current; // 0→1: entrada del contenido de cada paso
  const progressAnim = useRef(new Animated.Value(progressFor(0))).current;
  // Un valor de escala por carita (rebote al tocar, ver bounceMood más abajo).
  const faceScales = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(1))).current;

  // Si cambia el ancho (redimensionar la ventana en web, girar el teléfono)
  // se reposiciona al instante y sin animar — animar aquí sería un salto
  // raro, no una transición real entre pasos.
  useEffect(() => {
    stepAnim.setValue(-step * width);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const goTo = useCallback((rawNext) => {
    const next = clampStep(rawNext);
    setStep(next);
    enterAnim.setValue(0);
    Animated.parallel([
      Animated.timing(stepAnim, { toValue: -next * width, duration: 320, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: progressFor(next), duration: 320, useNativeDriver: false }),
      Animated.timing(enterAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [width, stepAnim, progressAnim, enterAnim]);

  const finish = useCallback(() => {
    // Cuenta como "ya visto" tanto al terminar como al saltar — en los dos
    // casos Splash no debe volver a mostrarlo (ver src/lib/onboarding.js).
    completeOnboarding();
    navigation.replace('Login');
  }, [completeOnboarding, navigation]);

  const handleNext = () => (isLastStep(step) ? finish() : goTo(step + 1));
  const handleBack = () => goTo(step - 1);

  // Rebote al tocar una carita: un pequeño overshoot (1 → 1.3 → tamaño final)
  // en vez de saltar directo al tamaño de "elegida" — así se siente vivo.
  const pickMood = (i) => {
    setPreviewMood(i);
    faceScales.forEach((v, idx) => {
      if (idx === i) {
        v.setValue(1);
        Animated.sequence([
          Animated.spring(v, { toValue: 1.32, friction: 3, tension: 220, useNativeDriver: true }),
          Animated.spring(v, { toValue: 1.12, friction: 4, tension: 180, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.spring(v, { toValue: 1, friction: 5, useNativeDriver: true }).start();
      }
    });
  };

  // enterStyle anima la entrada del texto (fade + un leve deslizamiento hacia
  // arriba) de cada paso; width/alignItems van aquí porque el contenedor
  // Animated.View no hereda el centrado del padre para hijos de ancho fijo
  // (la ilustración circular quedaba pegada a la izquierda sin esto — ver
  // heroPopStyle, que además la anima aparte con un "pop" de escala).
  const enterStyle = {
    width: '100%',
    alignItems: 'center',
    opacity: enterAnim,
    transform: [{ translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };
  const heroPopStyle = {
    opacity: enterAnim,
    transform: [{ scale: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
  };
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const stepLabel = fmt(t.onboardingStepOf, { n: step + 1, total: TOTAL_STEPS });
  const focusCount = onboardingFocus.length;
  const focusSummary = focusCount === 0
    ? t.onboardingReady
    : (focusCount === 1 ? t.onboardingFocusCountOne : fmt(t.onboardingFocusCount, { n: focusCount }));

  return (
    // height explícito, no solo flex:1: en la versión web, el envoltorio de
    // react-navigation-stack para cada pantalla es flex:'0 0 auto' — se ajusta
    // al contenido en vez de quedar fijo al viewport. Con 6 pasos y contenido
    // más alto que pantallas bajas (360x640), eso dejaba crecer TODA la
    // página (el header terminaba fuera de vista) en vez de que solo se
    // desplazara el ScrollView de cada paso. flexGrow:0/flexBasis:'auto' son
    // necesarios porque styles.container trae flex:1 (flexBasis:0%), y en un
    // flex column flexBasis:0% le gana a `height` para el tamaño del eje
    // principal — sin anularlo, el height de abajo se ignora en el cálculo
    // aunque quede en el estilo. Corta el efecto en la raíz, sin tocar
    // AppNavigator.js.
    <View
      testID="onboarding-root"
      style={[
        styles.container,
        { height, flexGrow: 0, flexShrink: 0, flexBasis: 'auto', paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 },
      ]}
    >
      {/* ── controles superiores: Atrás/marca, Saltar (siempre visible) ── */}
      <View style={styles.header}>
        {step > 0 ? (
          <TouchableOpacity
            testID="onboarding-back"
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={t.diaryBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.iconBtn}
          >
            <ChevronLeft />
          </TouchableOpacity>
        ) : <UpbWordmark size={18} />}
        <TouchableOpacity
          testID="onboarding-skip"
          onPress={finish}
          accessibilityRole="button"
          accessibilityLabel={t.onboardingSkipHint}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>{t.skip}</Text>
        </TouchableOpacity>
      </View>

      {/* ── indicador de progreso, animado ── */}
      <View
        style={styles.progressTrack}
        accessibilityRole="progressbar"
        accessibilityLabel={stepLabel}
        accessibilityValue={{ min: 1, max: TOTAL_STEPS, now: step + 1 }}
      >
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
      <Text style={styles.stepCounter}>{stepLabel}</Text>

      {/* ── carrusel: los 6 pasos van montados a la vez, uno al lado del otro,
          y se traslada con Animated — así las pruebas e2e que ya asumían
          "las pantallas vistas siguen en el DOM" (ver e2e/specs/access.spec.mjs)
          siguen viendo el mismo patrón, y el gesto se siente fluido. ── */}
      <View style={styles.carouselClip}>
        <Animated.View style={[styles.carouselRow, { width: width * TOTAL_STEPS, transform: [{ translateX: stepAnim }] }]}>

          {/* Paso 1 — bienvenida: qué es Raíz y un vistazo a los 4 pilares */}
          <ScrollView style={{ width, flex: 1 }} contentContainerStyle={styles.panel} showsVerticalScrollIndicator={false}>
            <Animated.View style={enterStyle}>
              <Animated.View style={heroPopStyle}>
                <LinearGradient colors={['#F0E9FF', '#FFE5EB']} style={styles.hero}>
                  <IllusMind />
                </LinearGradient>
              </Animated.View>
              <Text style={styles.title}>{t.welcomeTitle}</Text>
              <Text style={styles.body}>{t.welcomeBody}</Text>
              <View style={styles.pillarRow}>
                <Pillar label={t.onboardingPillarMood}><MoodFace level={3} size={34} /></Pillar>
                <Pillar label={t.onboardingPillarJournal}><IllusPlaceholder tone="lilac" label="diario" size={34} radius={10} /></Pillar>
                <Pillar label={t.onboardingPillarCommunity}><IllusPlaceholder tone="sky" label="redes" size={34} radius={10} /></Pillar>
                <Pillar label={t.onboardingPillarSupport}><IllusPlaceholder tone="rose" label="respirar" size={34} radius={10} /></Pillar>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Paso 2 — ánimo: aprender haciendo, toca una cara y ve la vista previa */}
          <ScrollView style={{ width, flex: 1 }} contentContainerStyle={styles.panel} showsVerticalScrollIndicator={false}>
            <Animated.View style={enterStyle}>
              <Text style={styles.title}>{t.onboardingMoodTitle}</Text>
              <Text style={styles.body}>{t.onboardingMoodBody}</Text>
              <View style={styles.moodRow}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <TouchableOpacity
                    key={i}
                    testID={`onboarding-mood-${i}`}
                    onPress={() => pickMood(i)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: previewMood === i }}
                    accessibilityLabel={t.moods[i]}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    style={styles.moodTouch}
                  >
                    <Animated.View style={{ transform: [{ scale: faceScales[i] }] }}>
                      <MoodFace level={i} size={48} bordered={previewMood === i} />
                    </Animated.View>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>{t.onboardingMoodPreviewLabel}</Text>
                {previewMood === null ? (
                  <Text style={styles.previewHint}>{t.onboardingMoodPreviewHint}</Text>
                ) : (
                  <View style={styles.previewRow}>
                    <MoodFace level={previewMood} size={40} />
                    <Text style={[styles.previewMoodText, { color: COLORS.mood[previewMood] }]}>{t.moods[previewMood]}</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          </ScrollView>

          {/* Paso 3 — diario privado: privacidad concreta + ejemplo marcado */}
          <ScrollView style={{ width, flex: 1 }} contentContainerStyle={styles.panel} showsVerticalScrollIndicator={false}>
            <Animated.View style={enterStyle}>
              <Animated.View style={[styles.heroSmall, heroPopStyle]}><IllusLock size={132} /></Animated.View>
              <Text style={styles.title}>{t.privacyTitle}</Text>
              <Text style={styles.body}>{t.privacyBody}</Text>
              <View style={[styles.sampleCard, { backgroundColor: COLORS.tones.lilac.bg }]}>
                <Text style={[styles.sampleBadge, { color: COLORS.tones.lilac.ink }]}>{t.onboardingJournalExampleBadge}</Text>
                <Text style={[styles.sampleTitle, { color: COLORS.tones.lilac.ink }]}>{t.onboardingJournalExampleTitle}</Text>
                <Text style={[styles.sampleBody, { color: COLORS.tones.lilac.ink }]}>{t.onboardingJournalExampleBody}</Text>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Paso 4 — comunidad: anónima y moderada, con un ejemplo marcado */}
          <ScrollView style={{ width, flex: 1 }} contentContainerStyle={styles.panel} showsVerticalScrollIndicator={false}>
            <Animated.View style={enterStyle}>
              <Animated.View style={[styles.heroSmall, heroPopStyle]}><IllusChat size={132} /></Animated.View>
              <Text style={styles.title}>{t.onboardingCommunityTitle}</Text>
              <Text style={styles.body}>{t.onboardingCommunityBody}</Text>
              <View style={[styles.sampleCard, { backgroundColor: COLORS.tones.sky.bg }]}>
                <Text style={[styles.sampleBadge, { color: COLORS.tones.sky.ink }]}>{t.onboardingCommunityExampleBadge}</Text>
                <View style={styles.postHead}>
                  <View style={styles.postAvatar} />
                  <Text style={[styles.sampleTitle, { color: COLORS.tones.sky.ink }]}>{t.onboardingCommunityExampleAuthor}</Text>
                </View>
                <Text style={[styles.sampleBody, { color: COLORS.tones.sky.ink }]}>{t.onboardingCommunityExampleBody}</Text>
                <View style={styles.reactionPill}>
                  <Text style={styles.reactionPillText}>🤗 {t.onboardingCommunityExampleReaction}</Text>
                </View>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Paso 5 — apoyo y bienestar: SOS sin asustar + retos/respiración/artículos */}
          <ScrollView style={{ width, flex: 1 }} contentContainerStyle={styles.panel} showsVerticalScrollIndicator={false}>
            <Animated.View style={enterStyle}>
              <Animated.View style={[styles.heroSmall, heroPopStyle]}><IllusHeart size={132} /></Animated.View>
              <Text style={styles.title}>{t.supportTitle}</Text>
              <Text style={styles.body}>{t.supportBody}</Text>
              <View style={styles.sosPreview}>
                <View style={styles.sosDot}>
                  <Text style={styles.sosDotText}>{t.onboardingSosLabel}</Text>
                </View>
                <Text style={styles.sosHint}>{t.onboardingSosHint}</Text>
              </View>
              <View style={styles.chipRow}>
                <View style={styles.chip}><Text style={styles.chipText}>{t.wlSectionChallenges}</Text></View>
                <View style={styles.chip}><Text style={styles.chipText}>{t.wlBreathingCardTitle}</Text></View>
                <View style={styles.chip}><Text style={styles.chipText}>{t.wlSectionArticles}</Text></View>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Paso 6 — enfoque personal (opcional, liviano) y cierre */}
          <ScrollView style={{ width, flex: 1 }} contentContainerStyle={styles.panel} showsVerticalScrollIndicator={false}>
            <Animated.View style={enterStyle}>
              <Animated.View style={[styles.heroSmall, heroPopStyle]}><RaizMark size={96} /></Animated.View>
              <Text style={styles.title}>{t.onboardingFocusTitle}</Text>
              <Text style={styles.body}>{t.onboardingFocusBody}</Text>
              <View style={styles.focusGrid}>
                {FOCUS_OPTIONS.map((key) => {
                  const selected = onboardingFocus.includes(key);
                  const tone = COLORS.tones[FOCUS_TONE[key]];
                  return (
                    <TouchableOpacity
                      key={key}
                      testID={`onboarding-focus-${key}`}
                      onPress={() => toggleOnboardingFocus(key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t[FOCUS_LABEL_KEY[key]]}
                      style={[
                        styles.focusChip,
                        { backgroundColor: tone.bg, borderColor: selected ? tone.ink : 'transparent' },
                      ]}
                    >
                      <Text style={[styles.focusChipText, { color: tone.ink }]}>{t[FOCUS_LABEL_KEY[key]]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.readyPill}>
                <Text style={styles.readyText}>{focusSummary}</Text>
              </View>
            </Animated.View>
          </ScrollView>

        </Animated.View>
      </View>

      <View style={styles.cta}>
        <PrimaryButton
          testID="onboarding-next"
          onPress={handleNext}
          accessibilityLabel={isLastStep(step) ? t.start : t.next}
        >
          {isLastStep(step) ? t.start : t.next}
        </PrimaryButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8, minHeight: 44,
  },
  iconBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    marginLeft: -12,
  },
  skipBtn: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.inkSoft },

  progressTrack: {
    marginHorizontal: 24, height: 6, borderRadius: RADIUS.pill,
    backgroundColor: '#E6E2F0', overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: RADIUS.pill, backgroundColor: COLORS.primary },
  stepCounter: {
    fontFamily: FONTS.uiSemiBold, fontSize: 11, color: COLORS.inkMuted,
    textAlign: 'center', marginTop: 6, letterSpacing: 0.5,
  },

  carouselClip: { flex: 1, overflow: 'hidden' },
  carouselRow: { flex: 1, flexDirection: 'row' },
  // Antes centrado con justifyContent:'center' en todo el alto disponible:
  // en pantallas altas el contenido quedaba flotando a media pantalla, con
  // un hueco enorme bajo la barra de progreso. Ahora arranca pegado arriba
  // (con algo de aire) y crece hacia abajo; si no cabe, el ScrollView de
  // cada paso se encarga (probado en 390x844 y 360x640).
  panel: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 8, paddingBottom: 28 },

  hero: {
    width: 200, height: 200, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  // Más grande que antes (120→148) para que la ilustración se sienta
  // protagonista y no un ícono perdido entre título y cuerpo.
  heroSmall: {
    width: 148, height: 148, borderRadius: 74, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  title: {
    fontFamily: 'Nunito_900Black', fontSize: 24,
    color: COLORS.ink, lineHeight: 30, marginBottom: 10, textAlign: 'center',
  },
  body: {
    fontFamily: FONTS.uiRegular, fontSize: 14.5,
    color: COLORS.inkSoft, lineHeight: 21, textAlign: 'center', marginBottom: 18,
  },

  // gap 8 y ancho 58: los 4 pilares caben en una sola fila incluso a 360px de
  // ancho (58*4 + 8*3 = 256, contra 304 disponibles con el padding del panel)
  // — con más separación se partían en dos líneas en pantallas angostas.
  pillarRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' },
  pillar: { alignItems: 'center', width: 58, gap: 6 },
  pillarIcon: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center', ...SHADOW,
  },
  pillarLabel: { fontFamily: FONTS.uiSemiBold, fontSize: 10.5, color: COLORS.inkSoft, textAlign: 'center' },

  moodRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  moodTouch: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  previewCard: {
    width: '100%', backgroundColor: COLORS.bg, borderRadius: RADIUS.lg,
    padding: 18, minHeight: 78, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.hair,
  },
  previewLabel: { fontFamily: FONTS.uiSemiBold, fontSize: 11.5, color: COLORS.inkMuted, marginBottom: 8, letterSpacing: 0.3 },
  previewHint: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkMuted },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewMoodText: { fontFamily: FONTS.extraBold, fontSize: 16 },

  sampleCard: {
    width: '100%', borderRadius: RADIUS.lg, padding: 16, gap: 6,
  },
  sampleBadge: {
    fontFamily: FONTS.uiBold, fontSize: 10.5, textTransform: 'uppercase',
    letterSpacing: 0.6, opacity: 0.75, marginBottom: 2,
  },
  sampleTitle: { fontFamily: FONTS.bold, fontSize: 14.5 },
  sampleBody: { fontFamily: FONTS.uiRegular, fontSize: 13.5, lineHeight: 19 },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.18)' },
  reactionPill: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4,
  },
  reactionPillText: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.ink },

  sosPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.tones.rose.bg, borderRadius: RADIUS.lg,
    padding: 14, width: '100%', marginBottom: 14,
  },
  sosDot: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.upbRed,
    alignItems: 'center', justifyContent: 'center',
  },
  sosDotText: { fontFamily: FONTS.extraBold, fontSize: 12, color: '#fff' },
  sosHint: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.tones.rose.ink, flex: 1 },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  chip: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.pill,
    paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.hair,
  },
  chipText: { fontFamily: FONTS.uiSemiBold, fontSize: 12.5, color: COLORS.inkSoft },

  focusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 18 },
  focusChip: {
    borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 2, minHeight: 44, alignItems: 'center', justifyContent: 'center',
  },
  focusChipText: { fontFamily: FONTS.uiBold, fontSize: 13.5 },
  // Centrado y en forma de píldora — antes quedaba como una línea suelta y
  // alineada a la izquierda debajo de los chips. Ahora funciona como
  // contador de lo elegido (o la invitación a empezar si no se eligió nada).
  readyPill: {
    backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.pill,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'center',
  },
  readyText: { fontFamily: FONTS.uiSemiBold, fontSize: 12.5, color: COLORS.primaryDeep, textAlign: 'center' },

  cta: { paddingHorizontal: 24 },
});
