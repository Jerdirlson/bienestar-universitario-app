import React, { useMemo, useState } from 'react';
import { View, Animated, SectionList, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MoodFace from '../../components/MoodFace';
import IllusPlaceholder from '../../components/IllusPlaceholder';
import { useApp } from '../../context/AppContext';
import { dayKey } from '../../lib/dates';
import { normalizeForScreening } from '../../lib/crisisSignals';
import { COLORS, SPACING, RADIUS } from '../../theme';
import { Screen, Text, Button, SearchField, EmptyState } from '../../ui';
import { PROMPT_STYLE, ScreenHeader, SyncBadge, dayLabel, fmt, promptFor, timeLabel } from './diaryUi';
import useKeyboardHeight from '../../components/useKeyboardHeight';

const norm = (s) => normalizeForScreening(s).trim();

export default function JournalListScreen({ navigation }) {
  const { t, lang, journal, ready } = useApp();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  // El botón "nueva entrada" es "absolute": el teclado de la búsqueda lo
  // taparía en Android (edge-to-edge, obligatorio desde el SDK 55 de Expo)
  // si no se sube con él.
  const keyboardHeight = useKeyboardHeight();

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return journal;
    return journal.filter((j) => {
      const prompt = promptFor(t, j.promptKey)?.title ?? '';
      return norm(`${j.title} ${j.body} ${prompt}`).includes(q);
    });
  }, [journal, query, t]);

  // Agrupadas por día (hora local del momento en que se escribieron).
  const sections = useMemo(() => {
    const groups = new Map();
    for (const j of filtered) {
      const key = dayKey(new Date(j.createdAt));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(j);
    }
    return [...groups].map(([key, data]) => ({ key, title: dayLabel(key, t, lang), data }));
  }, [filtered, t, lang]);

  const openPrompt = (k) => navigation.navigate('JournalEditor', { promptKey: k });

  const header = (
    <View style={styles.headerWrap}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t.diarySearchPlaceholder}
        onClear={() => setQuery('')}
        clearAccessibilityLabel={t.cancel}
      />

      {!query && (
        <>
          <Text variant="footnote" color={COLORS.secondaryLabel} style={styles.promptsHeader}>{t.diaryPromptsHeader}</Text>
          <View style={styles.promptsRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.promptsContent}
            >
              {t.diaryPrompts.map((p) => (
                <Pressable key={p.k} onPress={() => openPrompt(p.k)} style={styles.promptChip} accessibilityRole="button">
                  <IllusPlaceholder tone={PROMPT_STYLE[p.k]?.tone ?? 'lilac'} label={PROMPT_STYLE[p.k]?.label ?? ''} size={32} radius={RADIUS.sm} />
                  <Text variant="subhead">{p.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {/* H9: pista de que la fila sigue más allá del borde derecho —
                antes los chips se cortaban en seco sin ninguna señal. */}
            <LinearGradient
              pointerEvents="none"
              colors={[`${COLORS.bg}00`, COLORS.bg]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.promptsFade}
            />
          </View>
        </>
      )}
      <SyncBadge style={styles.syncRow} align="left" />
    </View>
  );

  const empty = !ready ? null : query ? (
    <Text variant="callout" color={COLORS.secondaryLabel} style={styles.noResults}>{fmt(t.diaryNoResults, { q: query })}</Text>
  ) : (
    <EmptyState icon="book-outline" title={t.diaryEmptyTitle} subtitle={t.diaryEmptyBody} style={styles.empty} />
  );

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScreenHeader title={t.diaryJournalTitle} onBack={() => navigation.goBack()} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        renderSectionHeader={({ section }) => <Text variant="footnote" color={COLORS.secondaryLabel} style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => {
          const prompt = promptFor(t, item.promptKey);
          const excerpt = item.body.replace(/\s+/g, ' ').slice(0, 140);
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => navigation.navigate('JournalEntry', { id: item.id })}
              accessibilityRole="button"
            >
              <View style={styles.flex1}>
                <Text variant="headline" numberOfLines={1}>
                  {item.title || prompt?.title || t.diaryUntitled}
                </Text>
                <Text variant="subhead" color={COLORS.secondaryLabel} numberOfLines={2} style={styles.mtXs}>{excerpt}</Text>
                <Text variant="caption1" color={COLORS.tertiaryLabel} style={styles.cardMeta}>
                  {timeLabel(item.createdAt, lang)}
                  {prompt && item.title ? ` · ${prompt.title}` : ''}
                </Text>
              </View>
              {item.mood != null && <MoodFace level={item.mood} size={32} />}
            </Pressable>
          );
        }}
      />
      <Animated.View
        style={[
          styles.fabWrap,
          { paddingBottom: insets.bottom + SPACING.lg },
          { transform: [{ translateY: Animated.multiply(keyboardHeight, -1) }] },
        ]}
      >
        <Button onPress={() => navigation.navigate('JournalEditor', {})}>
          {t.diaryNewEntry}
        </Button>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACING.lg },
  headerWrap: { paddingBottom: SPACING.xs },
  flex1: { flex: 1 },
  mtXs: { marginTop: SPACING.xs },
  syncRow: { marginTop: SPACING.md },
  promptsHeader: { marginTop: SPACING.lg, marginBottom: SPACING.sm },
  promptsRow: { marginHorizontal: -SPACING.lg },
  promptsContent: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  promptsFade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 28 },
  promptChip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, paddingVertical: SPACING.xs,
    paddingLeft: SPACING.xs, paddingRight: SPACING.md, minHeight: 44,
  },
  sectionTitle: { marginTop: SPACING.lg, marginBottom: SPACING.sm },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.sm,
  },
  pressed: { opacity: 0.85 },
  cardMeta: { marginTop: SPACING.sm },
  noResults: { textAlign: 'center', marginTop: SPACING.xxl },
  empty: { paddingTop: SPACING.xxl },
  fabWrap: { position: 'absolute', left: SPACING.xl, right: SPACING.xl, bottom: 0 },
});
