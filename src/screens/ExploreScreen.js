import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import IllusPlaceholder from '../components/IllusPlaceholder';
import ArticleCard from '../components/ArticleCard';
import TopBar from '../components/TopBar';
import SectionHeader from '../components/wellness/SectionHeader';
import ProgressSegments from '../components/wellness/ProgressSegments';
import useChallenges from '../components/wellness/useChallenges';
import { useApp } from '../context/AppContext';
import { listExploreResources } from '../data/explore';
import { ARTICLES, searchArticles } from '../data/wellnessContent';
import { activeChallenges } from '../data/challenges';
import { fmt } from '../i18n/wellness';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';
import { showAlert } from '../components/dialogs';

const SECTION_TONES = ['sun', 'peach', 'rose'];

// category en la base → título ya traducido. El contenido en sí (títulos,
// urls, imágenes) viene de explore_resources — lo administra el panel web,
// no un despliegue de la app.
const CATEGORY_ORDER = ['live_well', 'relieve_stress', 'relations', 'mindfulness'];

export default function ExploreScreen({ navigation }) {
  const { t, lang, sessionToken, onboardingFocus } = useApp();
  const [query, setQuery] = useState('');

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
    <View style={styles.container}>
      <TopBar title={t.exploreTitle} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Búsqueda sobre los artículos */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.wlSearchPlaceholder}
            placeholderTextColor={COLORS.inkMuted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searching && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clear}>{t.wlClearSearch}</Text>
            </TouchableOpacity>
          )}
        </View>

        {searching ? (
          <View style={styles.section}>
            <SectionHeader title={t.wlSearchResults} />
            {results.length === 0 && <Text style={styles.emptyText}>{t.wlSearchEmpty}</Text>}
            {results.map(a => (
              <TouchableOpacity key={a.id} style={styles.resultRow} onPress={() => openArticle(a.id)} activeOpacity={0.8}>
                <IllusPlaceholder tone={a.tone} label={a.illus} size={56} radius={14} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle}>{a[lang].title}</Text>
                  <Text style={styles.resultSub} numberOfLines={2}>{a[lang].summary}</Text>
                  <Text style={styles.meta}>{fmt(t.wlReadTime, { n: a.minutes })}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <>
            {/* Hero */}
            <View style={[styles.hero, { backgroundColor: COLORS.tones.sky.bg }]}>
              <IllusPlaceholder tone="sky" label="libro abierto" size={72} radius={14} />
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>{t.hero}</Text>
                <Text style={styles.heroSub}>{t.heroSub}</Text>
              </View>
            </View>

            {/* Ejercicios guiados */}
            <View style={styles.section}>
              <SectionHeader title={t.wlSectionExercises} />
              <View style={styles.exerciseRow}>
                <TouchableOpacity style={[styles.exerciseCard, { backgroundColor: COLORS.tones.lilac.bg }]} onPress={() => navigation.navigate('Breathing')} activeOpacity={0.85}>
                  <IllusPlaceholder tone="lilac" label="respirar" size={56} radius={14} />
                  <Text style={[styles.exerciseTitle, { color: COLORS.tones.lilac.ink }]}>{t.wlBreathingCardTitle}</Text>
                  <Text style={styles.exerciseSub}>{t.wlBreathingCardSub}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.exerciseCard, { backgroundColor: COLORS.tones.mint.bg }]} onPress={() => navigation.navigate('Grounding')} activeOpacity={0.85}>
                  <IllusPlaceholder tone="mint" label="mindful" size={56} radius={14} />
                  <Text style={[styles.exerciseTitle, { color: COLORS.tones.mint.ink }]}>{t.wlGroundingCardTitle}</Text>
                  <Text style={styles.exerciseSub}>{t.wlGroundingCardSub}</Text>
                </TouchableOpacity>
              </View>
              {exercises.length > 0 && <Text style={styles.meta}>{fmt(t.wlExercisesDone, { n: exercises.length })}</Text>}
            </View>

            {/* Retos */}
            <View style={styles.section}>
              <SectionHeader title={t.wlSectionChallenges} actionLabel={t.wlSeeChallenges} onAction={openChallenges} />
              {chLoading && <ActivityIndicator color={COLORS.primary} />}
              {!chLoading && chError && challenges.length === 0 && <Text style={styles.emptyText}>{t.wlLoadError}</Text>}
              {!chLoading && !chError && active.length === 0 && (
                <TouchableOpacity style={styles.card} onPress={openChallenges} activeOpacity={0.85}>
                  <Text style={styles.cardBody}>{t.wlNoActiveChallenges}</Text>
                  <Text style={styles.cardLink}>{t.wlSeeChallenges} →</Text>
                </TouchableOpacity>
              )}
              {active.slice(0, 3).map(c => (
                <TouchableOpacity key={c.key} style={styles.card} onPress={openChallenges} activeOpacity={0.85}>
                  <View style={styles.challengeHead}>
                    <Text style={styles.challengeTitle}>{c.title}</Text>
                    {c.checked_today && <Text style={styles.checked}>✓</Text>}
                  </View>
                  <ProgressSegments done={c.completed_days} total={c.total_days} height={5} />
                  <Text style={styles.meta}>{fmt(t.wlDayProgress, { done: c.completed_days, total: c.total_days })}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Artículos propios */}
            <View style={styles.section}>
              <SectionHeader title={t.wlSectionArticles} />
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
                style={{ marginHorizontal: -16 }}
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
              {resLoading && <ActivityIndicator color={COLORS.primary} />}
              {!resLoading && resError && (
                <View style={styles.card}>
                  <Text style={styles.cardBody}>{t.wlResourcesError}</Text>
                  <TouchableOpacity onPress={() => loadResources()}>
                    <Text style={styles.cardLink}>{t.wlRetry}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!resLoading && !resError && sections.length === 0 && (
                <Text style={styles.emptyText}>{t.wlResourcesEmpty}</Text>
              )}
            </View>

            {sections.map(sec => (
              <View key={sec.category} style={styles.subSection}>
                <View style={styles.subSectionHead}>
                  <Text style={styles.subSectionTitle}>{sec.title}</Text>
                  {sec.forYou && <Text style={styles.forYouBadge}>{t.justForYou}</Text>}
                </View>
                <ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
                  style={{ marginHorizontal: -16 }}
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

      {/* SOS FAB */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Sos')}
        style={styles.sosFab}
      >
        <Text style={styles.sosFabText}>SOS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 120, gap: 24 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.bgCard, borderRadius: 16, paddingHorizontal: 14, ...SHADOW,
  },
  searchIcon: { fontSize: 18, color: COLORS.inkMuted },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink },
  clear: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.primary },
  hero: {
    flexDirection: 'row', gap: 14, alignItems: 'center',
    borderRadius: 22, padding: 18,
  },
  heroText: { flex: 1 },
  heroTitle: { fontFamily: FONTS.extraBold, fontSize: 16, color: COLORS.ink, lineHeight: 22 },
  heroSub: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, marginTop: 6 },
  emptyText: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkMuted },
  section: { gap: 12 },
  subSection: { gap: 10, marginTop: -8 },
  subSectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subSectionTitle: { fontFamily: FONTS.extraBold, fontSize: 16, color: COLORS.inkSoft },
  forYouBadge: {
    fontFamily: FONTS.uiBold, fontSize: 10.5, color: COLORS.primary,
    backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 3, textTransform: 'uppercase', letterSpacing: 0.3,
  },
  exerciseRow: { flexDirection: 'row', gap: 12 },
  exerciseCard: { flex: 1, borderRadius: 20, padding: 14, gap: 8 },
  exerciseTitle: { fontFamily: FONTS.extraBold, fontSize: 15 },
  exerciseSub: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, lineHeight: 16 },
  card: { backgroundColor: COLORS.bgCard, borderRadius: 18, padding: 16, gap: 8, ...SHADOW },
  cardBody: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft, lineHeight: 19 },
  cardLink: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.primary },
  challengeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  challengeTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink, flexShrink: 1 },
  checked: { fontFamily: FONTS.black, fontSize: 16, color: COLORS.primary },
  meta: { fontFamily: FONTS.uiSemiBold, fontSize: 11, color: COLORS.inkMuted },
  resultRow: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: COLORS.bgCard, borderRadius: 18, padding: 12, ...SHADOW,
  },
  resultTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink },
  resultSub: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, marginTop: 2, lineHeight: 16 },
  sosFab: {
    position: 'absolute', right: 16, bottom: 80,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#F37171',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F37171', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  sosFabText: { fontFamily: 'Nunito_900Black', fontSize: 12, color: '#fff' },
});
