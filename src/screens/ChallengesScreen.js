import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import IllusPlaceholder from '../components/IllusPlaceholder';
import TopBar from '../components/TopBar';
import { useApp } from '../context/AppContext';
import { COLORS, FONTS, SHADOW } from '../theme';

export default function ChallengesScreen({ navigation }) {
  const { t, lang } = useApp();

  const challenges = lang === 'es' ? [
    { title: '7 días de gratitud', days: 7, done: 3, tone: 'sun' },
    { title: 'Dormir antes de 11pm', days: 14, done: 5, tone: 'lilac' },
    { title: 'Caminar 20 min', days: 30, done: 12, tone: 'mint' },
  ] : [
    { title: '7 days of gratitude', days: 7, done: 3, tone: 'sun' },
    { title: 'Sleep before 11pm', days: 14, done: 5, tone: 'lilac' },
    { title: 'Walk 20 min', days: 30, done: 12, tone: 'mint' },
  ];

  const achievements = lang === 'es'
    ? [
      { t: 'Primera semana', u: true }, { t: 'Racha de 7', u: true },
      { t: 'Racha de 30', u: false }, { t: 'Comunidad', u: true },
      { t: 'Respirar diario', u: false }, { t: 'Maratón mental', u: false },
    ]
    : [
      { t: 'First week', u: true }, { t: '7-day streak', u: true },
      { t: '30-day streak', u: false }, { t: 'Community', u: true },
      { t: 'Daily breath', u: false }, { t: 'Mental marathon', u: false },
    ];

  return (
    <View style={styles.container}>
      <TopBar title={t.challenges} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Active challenge hero */}
        <LinearGradient
          colors={['#6B4EFF', '#9A7DFF']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.activeHero}
        >
          <Text style={styles.activeLabel}>{t.activeChallenge.toUpperCase()}</Text>
          <Text style={styles.activeTitle}>{t.breatheTitle}</Text>
          <Text style={styles.activeSub}>{t.breatheSub}</Text>
          <View style={styles.progressBar}>
            {[1, 2, 3, 4, 5, 6, 7].map(d => (
              <View key={d} style={[styles.progressSegment, d <= 3 && styles.progressDone]} />
            ))}
          </View>
          <Text style={styles.activeDay}>{t.dayOf}</Text>
        </LinearGradient>

        {/* Other challenges */}
        {challenges.map((c, i) => (
          <View key={i} style={styles.challengeCard}>
            <IllusPlaceholder tone={c.tone} label={c.title.split(' ').slice(0, 2).join(' ').toLowerCase()} size={52} radius={12} />
            <View style={{ flex: 1 }}>
              <Text style={styles.challengeTitle}>{c.title}</Text>
              <View style={styles.challengeBar}>
                {Array.from({ length: c.days }).map((_, di) => (
                  <View key={di} style={[styles.barSegment, di < c.done && styles.barDone]} />
                ))}
              </View>
              <Text style={styles.challengeProgress}>{c.done}/{c.days}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.achievementsTitle}>{t.achievements}</Text>
        <View style={styles.achievementsGrid}>
          {achievements.map((a, i) => (
            <View key={i} style={[styles.achievementCard, !a.u && styles.achievementLocked]}>
              <View style={[styles.achievementIcon, !a.u && styles.achievementIconLocked]}>
                <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <Path d="M11 2l2.5 5.5 6 0.7-4.5 4 1.2 6-5.2-3-5.2 3 1.2-6-4.5-4 6-0.7L11 2z" fill="#fff" />
                </Svg>
              </View>
              <Text style={styles.achievementLabel}>{a.t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 100, gap: 10 },
  activeHero: { borderRadius: 22, padding: 20, gap: 6 },
  activeLabel: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.8)' },
  activeTitle: { fontFamily: FONTS.extraBold, fontSize: 22, color: '#fff' },
  activeSub: { fontFamily: FONTS.uiRegular, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  progressBar: { flexDirection: 'row', gap: 6, marginTop: 12 },
  progressSegment: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  progressDone: { backgroundColor: '#fff' },
  activeDay: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  challengeCard: {
    backgroundColor: COLORS.bgCard, borderRadius: 18, padding: 16,
    flexDirection: 'row', gap: 14, alignItems: 'center', ...SHADOW,
  },
  challengeTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink, marginBottom: 8 },
  challengeBar: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  barSegment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#EEEBF5', minWidth: 3 },
  barDone: { backgroundColor: COLORS.primary },
  challengeProgress: { fontFamily: FONTS.uiSemiBold, fontSize: 11, color: COLORS.inkMuted, marginTop: 6 },
  achievementsTitle: { fontFamily: FONTS.extraBold, fontSize: 22, color: COLORS.ink, marginTop: 14 },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  achievementCard: {
    width: '30%', backgroundColor: COLORS.primarySoft,
    borderRadius: 14, padding: 16, alignItems: 'center', gap: 8,
  },
  achievementLocked: { opacity: 0.45, backgroundColor: '#F2EFF9' },
  achievementIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  achievementIconLocked: { backgroundColor: '#C9C3DB' },
  achievementLabel: { fontFamily: FONTS.bold, fontSize: 11, color: COLORS.ink, lineHeight: 14, textAlign: 'center' },
});
