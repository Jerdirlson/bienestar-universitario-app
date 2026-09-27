import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Animated, TouchableOpacity, Pressable, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import IllusPlaceholder from '../components/IllusPlaceholder';
import ArticleCard from '../components/ArticleCard';
import ScreenHeader from '../components/wellness/ScreenHeader';
import SectionHeader from '../components/wellness/SectionHeader';
import ProgressSegments from '../components/wellness/ProgressSegments';
import useChallenges from '../components/wellness/useChallenges';
import { useApp } from '../context/AppContext';
import { listExploreResources } from '../data/explore';
import { ARTICLES, searchArticles } from '../data/wellnessContent';
import { activeChallenges } from '../data/challenges';
import { fmt } from '../i18n/wellness';
import { Screen, Text, Card, SearchField, Icon } from '../ui';
import { COLORS, SPACING, RADIUS, SHADOW_FLOATING } from '../theme';
import { showAlert } from '../components/dialogs';
import useKeyboardHeight from '../components/useKeyboardHeight';

const SECTION_TONES = ['sun', 'peach', 'rose'];
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// category en la base → título ya traducido. El contenido en sí (títulos,
// urls, imágenes) viene de explore_resources — lo administra el panel web,
// no un despliegue de la app.
const CATEGORY_ORDER = ['live_well', 'relieve_stress', 'relations', 'mindfulness'];

// Mismo helper que HomeScreen.js/TopBar.js: iniciales del correo para el
// avatar cuando no hay foto de perfil.
const initialsFromEmail = (email) => {
  const local = email?.split('@')[0] ?? '';
  return local.slice(0, 2).toUpperCase();
};

export default function ExploreScreen({ navigation }) {
  const { t, lang, sessionToken, onboardingFocus, userEmail } = useApp();
  const [query, setQuery] = useState('');
  // Igual que en Comunidad: el FAB de SOS no se oculta con el teclado (regla
  // "El SOS siempre funciona", CLAUDE.md), se sube por encima de él.
  const keyboardHeight = useKeyboardHeight();

  // Recursos curados del API (/explore). Si fallan, el resto de la pantalla sigue.
  const [resources, setResources] = useState([]);
  const [resLoading, setResLoading] = useState(true);
  const [resError, setResError] = useState(false);

  const loadResources = useCallback(async (cancelledRef = { current: false }) => {
    if (!sessionToken) { setResLoading(false); return; }
    setResLoading(true);
    setResError(false);
    try {
      const fresh = await listExploreResources(sessionToken);
      if (!cancelledRef.current) setResources(fresh);
    } catch {
      if (!cancelledRef.current) setResError(true);
    } finally {
      if (!cancelledRef.current) setResLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    const cancelled = { current: false };
    loadResources(cancelled);
    return () => { cancelled.current = true; };
  }, [loadResources]);

  const { challenges, exercises, loading: chLoading, error: chError } = useChallenges();
  const active = activeChallenges(challenges);

  // Enfoque elegido en el onboarding (src/screens/OnboardingScreen.js, paso
  // final): las categorías que la persona marcó se muestran primero, con una
  // etiqueta "Solo para ti" — el único uso real de esa elección, para que no
  // se quede guardada sin servir para nada. Sin elección, el orden es el de
  // siempre (CATEGORY_ORDER).
  const sections = CATEGORY_ORDER
    .map(category => ({
      category,
      title: { live_well: t.liveWell, relieve_stress: t.relieveStress, relations: t.relations, mindfulness: t.mindfulness }[category],
      items: resources.filter(r => r.category === category),
      forYou: onboardingFocus.includes(category),
    }))
    .filter(sec => sec.items.length > 0)
    .sort((a, b) => Number(b.forYou) - Number(a.forYou));

  const openResource = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      showAlert(t.linkErrorTitle, t.linkErrorBody);
    });
  };

  const openArticle = (id) => navigation.navigate('Article', { id });
  const openChallenges = () => navigation.navigate('Challenges');

  const searching = query.trim().length > 0;
  const results = searching ? searchArticles(query, lang) : [];

  return (
    // `edges` sin 'top': ScreenHeader ya aplica su propio inset superior (ver
    // src/components/wellness/ScreenHeader.js) — sumar el de Screen aquí
    // duplicaría el espacio bajo el notch/isla dinámica.
    <Screen edges={['left', 'right', 'bottom']}>
      {/* Pestaña raíz: título grande a la izquierda, estilo App Store /
          Apple Fitness (§5, §6 del sistema de diseño) en vez de la barra
          vieja en mayúsculas. El avatar de la derecha es el mismo acceso al
          perfil que Inicio y Comunidad (H-e2e): antes Explorar tampoco tenía
          forma de llegar a Perfil desde aquí. */}
      <ScreenHeader
        large
        title={t.exploreTitle}
        right={(
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            style={styles.avatar}
            accessibilityRole="button"
            accessibilityLabel={t.profileTitle}
          >
            {userEmail ? (
              <Text variant="subhead" color={COLORS.accent}>{initialsFromEmail(userEmail)}</Text>
            ) : (
              <Icon name="person-outline" size={18} color={COLORS.accent} />
            )}
          </Pressable>
        )}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t.wlSearchPlaceholder}
          onClear={() => setQuery('')}
          clearAccessibilityLabel={t.wlClearSearch}
          returnKeyType="search"
          autoCorrect={false}
        />

        {searching ? (
          <View style={styles.section}>
            <SectionHeader title={t.wlSearchResults} />
            {results.length === 0 && <Text variant="subhead" color={COLORS.tertiaryLabel}>{t.wlSearchEmpty}</Text>}
            {results.map(a => (
              <TouchableOpacity key={a.id} style={styles.resultRow} onPress={() => openArticle(a.id)} activeOpacity={0.8}>
                <IllusPlaceholder tone={a.tone} label={a.illus} size={56} radius={RADIUS.md} />
                <View style={{ flex: 1 }}>
                  <Text variant="headline" numberOfLines={1}>{a[lang].title}</Text>
                  <Text variant="subhead" color={COLORS.secondaryLabel} numberOfLines={2}>{a[lang].summary}</Text>
                  <Text variant="caption1" color={COLORS.tertiaryLabel}>{fmt(t.wlReadTime, { n: a.minutes })}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <>
            {/* Hero: cómo empezar, tarjeta grande estilo App Store */}
            <Card style={[styles.hero, { backgroundColor: COLORS.tones.sky.bg }]}>
              <IllusPlaceholder tone="sky" label="libro abierto" size={72} radius={RADIUS.md} />
              <View style={styles.heroText}>
                <Text variant="title3">{t.hero}</Text>
                <Text variant="subhead" color={COLORS.secondaryLabel} style={{ marginTop: 4 }}>{t.heroSub}</Text>
              </View>
            </Card>

            {/* Ejercicios guiados */}
            <View style={styles.section}>
              <SectionHeader title={t.wlSectionExercises} />
              <View style={styles.exerciseRow}>
                <TouchableOpacity style={[styles.exerciseCard, { backgroundColor: COLORS.tones.lilac.bg }]} onPress={() => navigation.navigate('Breathing')} activeOpacity={0.85}>
                  <IllusPlaceholder tone="lilac" label="respirar" size={56} radius={RADIUS.md} />
                  <Text variant="headline" style={{ color: COLORS.tones.lilac.ink }}>{t.wlBreathingCardTitle}</Text>
                  <Text variant="footnote" color={COLORS.secondaryLabel}>{t.wlBreathingCardSub}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.exerciseCard, { backgroundColor: COLORS.tones.mint.bg }]} onPress={() => navigation.navigate('Grounding')} activeOpacity={0.85}>
                  <IllusPlaceholder tone="mint" label="mindful" size={56} radius={RADIUS.md} />
                  <Text variant="headline" style={{ color: COLORS.tones.mint.ink }}>{t.wlGroundingCardTitle}</Text>
                  <Text variant="footnote" color={COLORS.secondaryLabel}>{t.wlGroundingCardSub}</Text>
                </TouchableOpacity>
              </View>
              {exercises.length > 0 && <Text variant="caption1" color={COLORS.tertiaryLabel}>{fmt(t.wlExercisesDone, { n: exercises.length })}</Text>}
            </View>

            {/* Retos */}
            <View style={styles.section}>
              <SectionHeader title={t.wlSectionChallenges} actionLabel={t.wlSeeChallenges} onAction={openChallenges} />
              {chLoading && <ActivityIndicator color={COLORS.accent} />}
              {!chLoading && chError && challenges.length === 0 && <Text variant="subhead" color={COLORS.tertiaryLabel}>{t.wlLoadError}</Text>}
              {!chLoading && !chError && active.length === 0 && (
                <TouchableOpacity onPress={openChallenges} activeOpacity={0.85}>
                  <Card>
                    <Text variant="subhead" color={COLORS.secondaryLabel}>{t.wlNoActiveChallenges}</Text>
                    <Text variant="headline" color={COLORS.accent} style={{ marginTop: 6 }}>{t.wlSeeChallenges} →</Text>
                  </Card>
                </TouchableOpacity>
              )}
              {active.slice(0, 3).map(c => (
                <TouchableOpacity key={c.key} onPress={openChallenges} activeOpacity={0.85} style={{ marginBottom: SPACING.sm }}>
                  <Card>
                    <View style={styles.challengeHead}>
                      <Text variant="headline" style={{ flexShrink: 1 }}>{c.title}</Text>
                      {c.checked_today && <Text variant="headline" color={COLORS.accent}>✓</Text>}
                    </View>
                    <View style={{ marginTop: SPACING.sm }}>
                      <ProgressSegments done={c.completed_days} total={c.total_days} height={5} />
                    </View>
                    <Text variant="caption1" color={COLORS.tertiaryLabel} style={{ marginTop: SPACING.xs }}>
                      {fmt(t.wlDayProgress, { done: c.completed_days, total: c.total_days })}
                    </Text>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>

            {/* Artículos propios */}
            <View style={styles.section}>
              <SectionHeader title={t.wlSectionArticles} />
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: SPACING.md, paddingHorizontal: SPACING.lg }}
                style={{ marginHorizontal: -SPACING.lg }}
              >
                {ARTICLES.map(a => (
                  <ArticleCard
                    key={a.id}
                    tone={a.tone}
                    label={a.illus}
                    title={a[lang].title}
                    duration={fmt(t.wlReadTime, { n: a.minutes })}
                    onPress={() => openArticle(a.id)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Recursos curados (API /explore) */}
            <View style={styles.section}>
              <SectionHeader title={t.wlSectionResources} />
              {resLoading && <ActivityIndicator color={COLORS.accent} />}
              {!resLoading && resError && (
                <Card>
                  <Text variant="subhead" color={COLORS.secondaryLabel}>{t.wlResourcesError}</Text>
                  <TouchableOpacity onPress={() => loadResources()}>
                    <Text variant="headline" color={COLORS.accent} style={{ marginTop: 6 }}>{t.wlRetry}</Text>
                  </TouchableOpacity>
                </Card>
              )}
              {!resLoading && !resError && sections.length === 0 && (
                <Text variant="subhead" color={COLORS.tertiaryLabel}>{t.wlResourcesEmpty}</Text>
              )}
            </View>

            {sections.map(sec => (
              <View key={sec.category} style={styles.subSection}>
                <View style={styles.subSectionHead}>
                  <Text variant="title3" color={COLORS.secondaryLabel}>{sec.title}</Text>
                  {sec.forYou && (
                    <View style={styles.forYouBadge}>
                      <Text variant="caption2" color={COLORS.accent} style={styles.forYouBadgeText}>{t.justForYou}</Text>
                    </View>
                  )}
                </View>
                <ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: SPACING.md, paddingHorizontal: SPACING.lg }}
                  style={{ marginHorizontal: -SPACING.lg }}
                >
                  {sec.items.map((item, i) => (
                    <ArticleCard
                      key={item.id}
                      tone={SECTION_TONES[i % SECTION_TONES.length]}
                      label={item.title}
                      title={item.title}
                      duration={item.platform}
                      imageUrl={item.image_url}
                      onPress={() => openResource(item.url)}
                    />
                  ))}
                </ScrollView>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* SOS FAB: sube por encima del teclado (§8), nunca se oculta ni se
          tapa con los resultados de búsqueda — la regla del SOS no negocia. */}
      <AnimatedTouchable
        onPress={() => navigation.navigate('Sos')}
        style={[styles.sosFab, { transform: [{ translateY: Animated.multiply(keyboardHeight, -1) }] }]}
        accessibilityRole="button"
        accessibilityLabel={t.sos}
      >
        <Text variant="footnote" style={styles.sosFabText}>SOS</Text>
      </AnimatedTouchable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: 120, gap: SPACING.xxl },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accentTint,
    alignItems: 'center', justifyContent: 'center',
  },
  hero: {
    flexDirection: 'row', gap: SPACING.md, alignItems: 'center',
  },
  heroText: { flex: 1 },
  section: { gap: SPACING.md },
  subSection: { gap: SPACING.sm, marginTop: -SPACING.sm },
  subSectionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  forYouBadge: {
    backgroundColor: COLORS.accentTint, borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  forYouBadgeText: { textTransform: 'uppercase', letterSpacing: 0.3 },
  exerciseRow: { flexDirection: 'row', gap: SPACING.md },
  exerciseCard: { flex: 1, borderRadius: RADIUS.xl, padding: SPACING.md, gap: SPACING.sm },
  challengeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultRow: {
    flexDirection: 'row', gap: SPACING.md, alignItems: 'center',
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, padding: SPACING.sm,
  },
  sosFab: {
    position: 'absolute', right: SPACING.lg, bottom: 80,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.sos,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW_FLOATING, shadowColor: COLORS.sos,
  },
  sosFabText: { color: '#fff', letterSpacing: 0.5 },
});
