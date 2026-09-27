import React, { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import IllusPlaceholder from '../components/IllusPlaceholder';
import ScreenHeader from '../components/wellness/ScreenHeader';
import ProgressSegments from '../components/wellness/ProgressSegments';
import useChallenges from '../components/wellness/useChallenges';
import { useApp } from '../context/AppContext';
import { activeChallenges, availableChallenges, completedChallenges } from '../data/challenges';
import { computeAchievements } from '../data/achievements';
import { fmt } from '../i18n/wellness';
import { Screen, Text, Card, Button, Icon } from '../ui';
import { COLORS, SPACING, RADIUS } from '../theme';
import { showAlert } from '../components/dialogs';

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
    showAlert(
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
    <Screen edges={['left', 'right', 'bottom']}>
      <ScreenHeader title={t.challenges} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text variant="subhead" color={COLORS.secondaryLabel}>{t.wlChallengesIntro}</Text>

        {loading && <ActivityIndicator style={{ marginTop: SPACING.md }} color={COLORS.accent} />}

        {!loading && error && challenges.length === 0 && (
          <Card style={styles.stateCard}>
            <Text variant="subhead" color={COLORS.secondaryLabel}>{t.wlLoadError}</Text>
            <TouchableOpacity onPress={reload}>
              <Text variant="headline" color={COLORS.accent}>{t.wlRetry}</Text>
            </TouchableOpacity>
          </Card>
        )}

        {notice && (
          <View style={styles.notice}>
            <Text variant="subhead" color={COLORS.primaryDeep}>{notice}</Text>
          </View>
        )}

        {/* Reto activo principal */}
        {hero && (
          <LinearGradient colors={[COLORS.accent, COLORS.primaryDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.activeHero}>
            <Text variant="caption1" style={styles.activeLabel}>{t.activeChallenge.toUpperCase()}</Text>
            <Text variant="title2" style={styles.activeTitle}>{hero.title}</Text>
            {metaFor(hero.key).desc && <Text variant="subhead" style={styles.activeSub}>{t[metaFor(hero.key).desc]}</Text>}
            <View style={{ marginTop: SPACING.sm }}>
              <ProgressSegments done={hero.completed_days} total={hero.total_days} light height={8} />
            </View>
            <Text variant="footnote" style={styles.activeDay}>{fmt(t.wlDayProgress, { done: hero.completed_days, total: hero.total_days })}</Text>
            <View style={styles.heroActions}>
              <TouchableOpacity
                disabled={hero.checked_today || busyKey === hero.key}
                onPress={() => checkIn(hero)}
                style={[styles.heroBtn, hero.checked_today && styles.heroBtnDone]}
              >
                <Text variant="headline" style={hero.checked_today ? styles.heroBtnTextDone : styles.heroBtnText}>
                  {hero.checked_today ? `✓ ${t.wlCheckedToday}` : t.wlCheckInToday}
                </Text>
              </TouchableOpacity>
              {hero.key === 'breathing_7' && !hero.checked_today && (
                <TouchableOpacity onPress={() => navigation.navigate('Breathing')} style={styles.heroGhostBtn}>
                  <Text variant="headline" style={styles.heroGhostText}>{t.wlBreatheNow}</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => confirmLeave(hero)} style={styles.leaveLink} disabled={busyKey === hero.key}>
              <Text variant="subhead" style={styles.leaveLinkTextLight}>{t.wlLeave}</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {/* Otros retos en curso */}
        {restActive.map(c => (
          <Card key={c.key} style={styles.challengeCard}>
            <IllusPlaceholder tone={metaFor(c.key).tone} label={metaFor(c.key).illus} size={52} radius={RADIUS.md} />
            <View style={{ flex: 1, gap: SPACING.xs }}>
              <Text variant="headline" numberOfLines={1}>{c.title}</Text>
              <ProgressSegments done={c.completed_days} total={c.total_days} height={5} />
              <Text variant="caption1" color={COLORS.tertiaryLabel}>{fmt(t.wlDayProgress, { done: c.completed_days, total: c.total_days })}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  disabled={c.checked_today || busyKey === c.key}
                  onPress={() => checkIn(c)}
                  style={[styles.smallBtn, c.checked_today && styles.smallBtnDone]}
                >
                  <Text variant="footnote" style={c.checked_today ? styles.smallBtnTextDone : styles.smallBtnText}>
                    {c.checked_today ? `✓ ${t.wlCheckedToday}` : t.wlCheckInToday}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmLeave(c)} disabled={busyKey === c.key}>
                  <Text variant="footnote" color={COLORS.tertiaryLabel} style={styles.underline}>{t.wlLeave}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        ))}

        {/* Disponibles */}
        {available.length > 0 && <Text variant="title2" style={styles.sectionTitle}>{t.wlAvailableTitle}</Text>}
        {available.map(c => (
          <Card key={c.key} style={styles.challengeCard}>
            <IllusPlaceholder tone={metaFor(c.key).tone} label={metaFor(c.key).illus} size={52} radius={RADIUS.md} />
            <View style={{ flex: 1, gap: SPACING.xs }}>
              <Text variant="headline" numberOfLines={1}>{c.title}</Text>
              {metaFor(c.key).desc && <Text variant="footnote" color={COLORS.secondaryLabel}>{t[metaFor(c.key).desc]}</Text>}
              <Text variant="caption1" color={COLORS.tertiaryLabel}>{fmt(t.wlDaysCount, { n: c.total_days })}</Text>
            </View>
            <TouchableOpacity onPress={() => run(c.key, () => client.join(c.key))} disabled={busyKey === c.key} style={styles.joinBtn}>
              <Text variant="footnote" color={COLORS.primaryDeep}>{t.wlJoin}</Text>
            </TouchableOpacity>
          </Card>
        ))}

        {/* Completados */}
        {completed.length > 0 && <Text variant="title2" style={styles.sectionTitle}>{t.wlCompletedTitle}</Text>}
        {completed.map(c => (
          <Card key={c.key} style={[styles.challengeCard, styles.completedCard]}>
            <IllusPlaceholder tone={metaFor(c.key).tone} label={metaFor(c.key).illus} size={44} radius={RADIUS.md} />
            <View style={{ flex: 1, gap: SPACING.xs }}>
              <Text variant="headline" numberOfLines={1}>{c.title}</Text>
              <Text variant="caption1" color={COLORS.tertiaryLabel}>{fmt(t.wlCompletedOn, { date: formatDate(c.completed_at) })}</Text>
            </View>
            <Icon name="checkmark-circle" size={22} color={COLORS.accent} />
          </Card>
        ))}

        {mode === 'local' && !loading && (
          <Text variant="caption1" color={COLORS.tertiaryLabel} style={styles.localNote}>{t.wlLocalModeNote}</Text>
        )}

        {/* Logros */}
        <Text variant="title2" style={styles.sectionTitle}>{t.achievements}</Text>
        <Text variant="footnote" color={COLORS.tertiaryLabel} style={styles.achNote}>{t.wlAchievementsNote}</Text>
        <View style={styles.achievementsGrid}>
          {achievements.map(a => (
            <View key={a.id} style={[styles.achievementCard, !a.unlocked && styles.achievementLocked]}>
              <View style={[styles.achievementIcon, !a.unlocked && styles.achievementIconLocked]}>
                <Icon name="star" size={20} color="#fff" />
              </View>
              <Text variant="caption1" style={styles.achievementLabel}>{t[achievementKey(a.id)]}</Text>
              {!a.unlocked && (
                <Text variant="caption2" color={COLORS.tertiaryLabel}>{fmt(t.wlAchProgress, { current: a.current, target: a.target })}</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: 100, gap: SPACING.sm },
  stateCard: { gap: SPACING.sm, alignItems: 'flex-start' },
  notice: {
    backgroundColor: COLORS.accentTint, borderRadius: RADIUS.md, padding: SPACING.md,
  },
  activeHero: { borderRadius: RADIUS.xl, padding: SPACING.xl, gap: SPACING.xs },
  activeLabel: { letterSpacing: 1, color: 'rgba(255,255,255,0.8)' },
  activeTitle: { color: '#fff' },
  activeSub: { color: 'rgba(255,255,255,0.85)' },
  activeDay: { color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  heroActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, flexWrap: 'wrap' },
  heroBtn: { backgroundColor: '#fff', borderRadius: RADIUS.pill, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  heroBtnDone: { backgroundColor: 'rgba(255,255,255,0.25)' },
  heroBtnText: { color: COLORS.accent },
  heroBtnTextDone: { color: '#fff' },
  heroGhostBtn: { borderRadius: RADIUS.pill, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
  heroGhostText: { color: '#fff' },
  leaveLink: { alignSelf: 'flex-start', marginTop: SPACING.xs, paddingVertical: 4 },
  leaveLinkTextLight: { color: 'rgba(255,255,255,0.8)', textDecorationLine: 'underline' },
  underline: { textDecorationLine: 'underline' },
  sectionTitle: { color: COLORS.label, marginTop: SPACING.md },
  challengeCard: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
  completedCard: { opacity: 0.9 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.xs },
  smallBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.pill, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md },
  smallBtnDone: { backgroundColor: COLORS.accentTint },
  smallBtnText: { color: '#fff' },
  smallBtnTextDone: { color: COLORS.primaryDeep },
  joinBtn: { backgroundColor: COLORS.accentTint, borderRadius: RADIUS.pill, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md },
  localNote: { textAlign: 'center', marginTop: SPACING.xs },
  achNote: { marginTop: -4 },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  achievementCard: {
    width: '30%', backgroundColor: COLORS.accentTint,
    borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', gap: SPACING.sm,
  },
  achievementLocked: { opacity: 0.55, backgroundColor: COLORS.fill },
  achievementIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  achievementIconLocked: { backgroundColor: COLORS.tertiaryLabel },
  achievementLabel: { color: COLORS.label, textAlign: 'center' },
});
