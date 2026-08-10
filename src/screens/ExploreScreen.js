import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import IllusPlaceholder from '../components/IllusPlaceholder';
import ArticleCard from '../components/ArticleCard';
import TopBar from '../components/TopBar';
import { useApp } from '../context/AppContext';
import { COLORS, FONTS, SHADOW } from '../theme';

export default function ExploreScreen({ navigation }) {
  const { t } = useApp();

  const sections = [
    { title: t.liveWell, items: [{ idx: 3, tone: 'sun' }, { idx: 4, tone: 'peach' }, { idx: 5, tone: 'rose' }] },
    { title: t.relieveStress, items: [{ idx: 6, tone: 'sky' }, { idx: 7, tone: 'rose' }, { idx: 8, tone: 'mint' }] },
    { title: t.relations, items: [{ idx: 9, tone: 'sky' }, { idx: 0, tone: 'blush' }, { idx: 1, tone: 'lilac' }] },
    { title: t.mindfulness, items: [{ idx: 10, tone: 'lilac' }, { idx: 11, tone: 'sun' }, { idx: 2, tone: 'mint' }] },
  ];

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

        {sections.map((sec, si) => (
          <View key={si} style={styles.section}>
            <Text style={styles.sectionTitle}>{sec.title}</Text>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 16 }}
              style={{ marginHorizontal: -16 }}
            >
              <View style={{ width: 0 }} />
              {sec.items.map((it, i) => (
                <ArticleCard
                  key={i}
                  tone={it.tone}
                  label={t.articles[it.idx].t}
                  title={t.articles[it.idx].t}
                  duration={t.articles[it.idx].d}
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
