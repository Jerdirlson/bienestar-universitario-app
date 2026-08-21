import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert, ActivityIndicator } from 'react-native';
import IllusPlaceholder from '../components/IllusPlaceholder';
import ArticleCard from '../components/ArticleCard';
import TopBar from '../components/TopBar';
import { useApp } from '../context/AppContext';
import { listExploreResources } from '../data/explore';
import { COLORS, FONTS, SHADOW } from '../theme';

const SECTION_TONES = ['sun', 'peach', 'rose'];

// category en la base → título ya traducido. El contenido en sí (títulos,
// urls, imágenes) viene de explore_resources — lo administra el panel web,
// no un despliegue de la app.
const CATEGORY_ORDER = ['live_well', 'relieve_stress', 'relations', 'mindfulness'];

export default function ExploreScreen({ navigation }) {
  const { t, sessionToken } = useApp();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!sessionToken) return;
    (async () => {
      try {
        const fresh = await listExploreResources(sessionToken);
        if (!cancelled) setResources(fresh);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionToken]);

  const sections = CATEGORY_ORDER.map(category => ({
    category,
    title: { live_well: t.liveWell, relieve_stress: t.relieveStress, relations: t.relations, mindfulness: t.mindfulness }[category],
    items: resources.filter(r => r.category === category),
  })).filter(sec => sec.items.length > 0);

  const openArticle = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert(t.linkErrorTitle, t.linkErrorBody);
    });
  };

  return (
    <View style={styles.container}>
      <TopBar title={t.exploreTitle} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: COLORS.tones.sky.bg }]}>
          <IllusPlaceholder tone="sky" label="libro abierto" size={72} radius={14} />
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{t.hero}</Text>
            <Text style={styles.heroSub}>{t.heroSub}</Text>
          </View>
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />}
        {!loading && loadError && <Text style={styles.emptyText}>{t.communityErrorBody}</Text>}

        {sections.map((sec, si) => (
          <View key={si} style={styles.section}>
            <Text style={styles.sectionTitle}>{sec.title}</Text>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 16 }}
              style={{ marginHorizontal: -16 }}
            >
              <View style={{ width: 0 }} />
              {sec.items.map((item, i) => (
                <ArticleCard
                  key={item.id}
                  tone={SECTION_TONES[i % SECTION_TONES.length]}
                  label={item.title}
                  title={item.title}
                  duration={item.platform}
                  imageUrl={item.image_url}
                  onPress={() => openArticle(item.url)}
                />
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* Challenges FAB */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Challenges')}
        style={styles.challengesFab}
      >
        <Text style={{ fontSize: 18 }}>⭐</Text>
      </TouchableOpacity>

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
  content: { padding: 16, paddingBottom: 100, gap: 24 },
  hero: {
    flexDirection: 'row', gap: 14, alignItems: 'center',
    borderRadius: 22, padding: 18,
  },
  heroText: { flex: 1 },
  heroTitle: { fontFamily: FONTS.extraBold, fontSize: 16, color: COLORS.ink, lineHeight: 22 },
  heroSub: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, marginTop: 6 },
  emptyText: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkMuted, textAlign: 'center', marginTop: 12 },
  section: { gap: 12 },
  sectionTitle: { fontFamily: FONTS.extraBold, fontSize: 22, color: COLORS.ink },
  challengesFab: {
    position: 'absolute', right: 16, top: 70,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
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
