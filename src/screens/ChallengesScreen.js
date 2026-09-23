import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import IllusPlaceholder from '../components/IllusPlaceholder';
import TopBar from '../components/TopBar';
import ProgressSegments from '../components/wellness/ProgressSegments';
import useChallenges from '../components/wellness/useChallenges';
import { useApp } from '../context/AppContext';
import { activeChallenges, availableChallenges, completedChallenges } from '../data/challenges';
import { computeAchievements } from '../data/achievements';
import { fmt } from '../i18n/wellness';
import { COLORS, FONTS, SHADOW } from '../theme';

// Descripción y dibujo por clave del reto. El título viene del servidor (o de
// la copia local de la semilla); un reto nuevo sin entrada aquí se muestra
// igual, solo sin descripción.
const CHALLENGE_META = {
  breathing_7: { desc: 'wlDescBreathing', tone: 'lilac', illus: 'respirar' },
  gratitude_7: { desc: 'wlDescGratitude', tone: 'sun', illus: 'gratitud' },
  sleep_14: { desc: 'wlDescSleep', tone: 'sky', illus: 'dormir' },
  walk_30: { desc: 'wlDescWalk', tone: 'mint', illus: 'walk' },
};
const metaFor = (key) => CHALLENGE_META[key] ?? { desc: null, tone: 'peach', illus: '' };

const achievementKey = (id) =>
  'wlAch' + id.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');

export default function ChallengesScreen({ navigation }) {
  const { t, lang, streak, entries } = useApp();
  const { client, challenges, exercises, loading, error, mode, reload } = useChallenges();
  const [busyKey, setBusyKey] = useState(null);
  const [notice, setNotice] = useState(null);

  const active = activeChallenges(challenges);
  const available = availableChallenges(challenges);
  const completed = completedChallenges(challenges);

  const achievements = useMemo(
    () => computeAchievements({ streak: streak ?? 0, entries: entries ?? [], challenges, exercises }),
    [streak, entries, challenges, exercises],
  );

  const run = async (key, action) => {
    setBusyKey(key);
    setNotice(null);
    try {
      await action();
      await reload();
    } catch (e) {
      setNotice(e?.code === 'ya_registrado_hoy' ? t.wlAlreadyToday : t.wlActionError);
      await reload().catch(() => {});
    } finally {
      setBusyKey(null);
    }
  };

  const checkIn = (c) => run(c.key, async () => {
    await client.checkIn(c.key);
    if (c.completed_days + 1 >= c.total_days) setNotice(t.wlChallengeCompleted);
  });

  const confirmLeave = (c) => {
    Alert.alert(
      t.wlLeaveConfirmTitle,
      fmt(t.wlLeaveConfirmBody, { title: c.title }),
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.wlLeave, style: 'destructive', onPress: () => run(c.key, () => client.leave(c.key)) },
      ],
    );
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const [hero, ...restActive] = active;

  return (
    <View style={styles.container}>
      <TopBar title={t.challenges} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t.wlChallengesIntro}</Text>

        {loading && <ActivityIndicator style={{ marginTop: 16 }} color={COLORS.primary} />}

        {!loading && error && challenges.length === 0 && (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>{t.wlLoadError}</Text>
            <TouchableOpacity onPress={reload} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>{t.wlRetry}</Text>
            </TouchableOpacity>
          </View>
        )}

        {notice && <Text style={styles.notice}>{notice}</Text>}

        {/* Reto activo principal */}
        {hero && (
          <LinearGradient colors={['#6B4EFF', '#9A7DFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.activeHero}>
            <Text style={styles.activeLabel}>{t.activeChallenge.toUpperCase()}</Text>
            <Text style={styles.activeTitle}>{hero.title}</Text>
            {metaFor(hero.key).desc && <Text style={styles.activeSub}>{t[metaFor(hero.key).desc]}</Text>}
            <View style={{ marginTop: 12 }}>
              <ProgressSegments done={hero.completed_days} total={hero.total_days} light height={8} />
            </View>
            <Text style={styles.activeDay}>{fmt(t.wlDayProgress, { done: hero.completed_days, total: hero.total_days })}</Text>
            <View style={styles.heroActions}>
              <TouchableOpacity
                disabled={hero.checked_today || busyKey === hero.key}
                onPress={() => checkIn(hero)}
                style={[styles.heroBtn, hero.checked_today && styles.heroBtnDone]}
              >
                <Text style={[styles.heroBtnText, hero.checked_today && styles.heroBtnTextDone]}>
                  {hero.checked_today ? `✓ ${t.wlCheckedToday}` : t.wlCheckInToday}
                </Text>
              </TouchableOpacity>
              {hero.key === 'breathing_7' && !hero.checked_today && (
                <TouchableOpacity onPress={() => navigation.navigate('Breathing')} style={styles.heroGhostBtn}>
                  <Text style={styles.heroGhostText}>{t.wlBreatheNow}</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => confirmLeave(hero)} style={styles.leaveLink} disabled={busyKey === hero.key}>
              <Text style={styles.leaveLinkTextLight}>{t.wlLeave}</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {/* Otros retos en curso */}
        {restActive.map(c => (
          <View key={c.key} style={styles.challengeCard}>
            <IllusPlaceholder tone={metaFor(c.key).tone} label={metaFor(c.key).illus} size={52} radius={12} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.challengeTitle}>{c.title}</Text>
              <ProgressSegments done={c.completed_days} total={c.total_days} height={5} />
              <Text style={styles.challengeProgress}>{fmt(t.wlDayProgress, { done: c.completed_days, total: c.total_days })}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  disabled={c.checked_today || busyKey === c.key}
                  onPress={() => checkIn(c)}
                  style={[styles.smallBtn, c.checked_today && styles.smallBtnDone]}
                >
                  <Text style={[styles.smallBtnText, c.checked_today && styles.smallBtnTextDone]}>
                    {c.checked_today ? `✓ ${t.wlCheckedToday}` : t.wlCheckInToday}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmLeave(c)} disabled={busyKey === c.key}>
                  <Text style={styles.leaveLinkText}>{t.wlLeave}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {/* Disponibles */}
        {available.length > 0 && <Text style={styles.sectionTitle}>{t.wlAvailableTitle}</Text>}
        {available.map(c => (
          <View key={c.key} style={styles.challengeCard}>
            <IllusPlaceholder tone={metaFor(c.key).tone} label={metaFor(c.key).illus} size={52} radius={12} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.challengeTitle}>{c.title}</Text>
              {metaFor(c.key).desc && <Text style={styles.challengeDesc}>{t[metaFor(c.key).desc]}</Text>}
              <Text style={styles.challengeProgress}>{fmt(t.wlDaysCount, { n: c.total_days })}</Text>
            </View>
            <TouchableOpacity
              onPress={() => run(c.key, () => client.join(c.key))}
              disabled={busyKey === c.key}
              style={styles.joinBtn}
            >
              <Text style={styles.joinBtnText}>{t.wlJoin}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Completados */}
        {completed.length > 0 && <Text style={styles.sectionTitle}>{t.wlCompletedTitle}</Text>}
        {completed.map(c => (
          <View key={c.key} style={[styles.challengeCard, styles.completedCard]}>
            <IllusPlaceholder tone={metaFor(c.key).tone} label={metaFor(c.key).illus} size={44} radius={12} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.challengeTitle}>{c.title}</Text>
              <Text style={styles.challengeProgress}>
                {fmt(t.wlCompletedOn, { date: formatDate(c.completed_at) })}
              </Text>
            </View>
            <Text style={styles.check}>✓</Text>
          </View>
        ))}

        {mode === 'local' && !loading && <Text style={styles.localNote}>{t.wlLocalModeNote}</Text>}

        {/* Logros */}
        <Text style={styles.sectionTitle}>{t.achievements}</Text>
        <Text style={styles.achNote}>{t.wlAchievementsNote}</Text>
        <View style={styles.achievementsGrid}>
          {achievements.map(a => (
            <View key={a.id} style={[styles.achievementCard, !a.unlocked && styles.achievementLocked]}>
              <View style={[styles.achievementIcon, !a.unlocked && styles.achievementIconLocked]}>
                <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <Path d="M11 2l2.5 5.5 6 0.7-4.5 4 1.2 6-5.2-3-5.2 3 1.2-6-4.5-4 6-0.7L11 2z" fill="#fff" />
                </Svg>
              </View>
              <Text style={styles.achievementLabel}>{t[achievementKey(a.id)]}</Text>
              {!a.unlocked && (
                <Text style={styles.achievementProgress}>{fmt(t.wlAchProgress, { current: a.current, target: a.target })}</Text>
              )}
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
  intro: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft, lineHeight: 19, marginBottom: 4 },
  stateCard: { backgroundColor: COLORS.bgCard, borderRadius: 18, padding: 16, gap: 10, alignItems: 'flex-start', ...SHADOW },
  stateText: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft },
  notice: {
    fontFamily: FONTS.uiSemiBold, fontSize: 13, color: COLORS.primaryDeep,
    backgroundColor: COLORS.primarySoft, borderRadius: 12, padding: 12,
  },
  activeHero: { borderRadius: 22, padding: 20, gap: 6 },
  activeLabel: { fontFamily: FONTS.uiBold, fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.8)' },
  activeTitle: { fontFamily: FONTS.extraBold, fontSize: 22, color: '#fff' },
  activeSub: { fontFamily: FONTS.uiRegular, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
  activeDay: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  heroBtn: { backgroundColor: '#fff', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  heroBtnDone: { backgroundColor: 'rgba(255,255,255,0.25)' },
  heroBtnText: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.primary },
  heroBtnTextDone: { color: '#fff' },
  heroGhostBtn: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
  heroGhostText: { fontFamily: FONTS.extraBold, fontSize: 13, color: '#fff' },
  leaveLink: { alignSelf: 'flex-start', marginTop: 6, paddingVertical: 4 },
  leaveLinkTextLight: { fontFamily: FONTS.uiMedium, fontSize: 12, color: 'rgba(255,255,255,0.8)', textDecorationLine: 'underline' },
  leaveLinkText: { fontFamily: FONTS.uiMedium, fontSize: 12, color: COLORS.inkMuted, textDecorationLine: 'underline' },
  sectionTitle: { fontFamily: FONTS.extraBold, fontSize: 22, color: COLORS.ink, marginTop: 14 },
  challengeCard: {
    backgroundColor: COLORS.bgCard, borderRadius: 18, padding: 16,
    flexDirection: 'row', gap: 14, alignItems: 'center', ...SHADOW,
  },
  completedCard: { opacity: 0.9 },
  challengeTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink },
  challengeDesc: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, lineHeight: 17 },
  challengeProgress: { fontFamily: FONTS.uiSemiBold, fontSize: 11, color: COLORS.inkMuted },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  smallBtn: { backgroundColor: COLORS.primary, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  smallBtnDone: { backgroundColor: COLORS.primarySoft },
  smallBtnText: { fontFamily: FONTS.extraBold, fontSize: 12, color: '#fff' },
  smallBtnTextDone: { color: COLORS.primaryDeep },
  joinBtn: { backgroundColor: COLORS.primarySoft, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  joinBtnText: { fontFamily: FONTS.extraBold, fontSize: 12, color: COLORS.primaryDeep },
  check: { fontFamily: FONTS.black, fontSize: 20, color: COLORS.primary },
  localNote: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted, textAlign: 'center', marginTop: 6 },
  achNote: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkMuted, marginTop: -4 },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  achievementCard: {
    width: '30%', backgroundColor: COLORS.primarySoft,
    borderRadius: 14, padding: 14, alignItems: 'center', gap: 8,
  },
  achievementLocked: { opacity: 0.55, backgroundColor: '#F2EFF9' },
  achievementIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  achievementIconLocked: { backgroundColor: '#C9C3DB' },
  achievementLabel: { fontFamily: FONTS.bold, fontSize: 11, color: COLORS.ink, lineHeight: 14, textAlign: 'center' },
  achievementProgress: { fontFamily: FONTS.uiSemiBold, fontSize: 10, color: COLORS.inkMuted },
});
