import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SectionList, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import TopBar from '../../components/TopBar';
import MoodFace from '../../components/MoodFace';
import PrimaryButton from '../../components/PrimaryButton';
import IllusPlaceholder from '../../components/IllusPlaceholder';
import { useApp } from '../../context/AppContext';
import { dayKey } from '../../lib/dates';
import { normalizeForScreening } from '../../lib/crisisSignals';
import { COLORS, FONTS, SHADOW } from '../../theme';
import { PROMPT_STYLE, SyncBadge, dayLabel, fmt, promptFor, timeLabel } from './diaryUi';

const norm = (s) => normalizeForScreening(s).trim();

export default function JournalListScreen({ navigation }) {
  const { t, lang, journal, ready } = useApp();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

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
      <View style={styles.searchBox}>
        <Svg width="16" height="16" viewBox="0 0 16 16">
          <Circle cx="7" cy="7" r="5" stroke={COLORS.inkMuted} strokeWidth="1.8" fill="none" />
          <Path d="M11 11l3.5 3.5" stroke={COLORS.inkMuted} strokeWidth="1.8" strokeLinecap="round" />
        </Svg>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.diarySearchPlaceholder}
          placeholderTextColor={COLORS.inkMuted}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel={t.diarySearchPlaceholder}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t.cancel}>
            <Text style={styles.clear}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {!query && (
        <>
          <Text style={styles.promptsHeader}>{t.diaryPromptsHeader}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -16 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          >
            {t.diaryPrompts.map((p) => (
              <TouchableOpacity key={p.k} onPress={() => openPrompt(p.k)} style={styles.promptChip} activeOpacity={0.8}>
                <IllusPlaceholder tone={PROMPT_STYLE[p.k]?.tone ?? 'lilac'} label={PROMPT_STYLE[p.k]?.label ?? ''} size={36} radius={10} />
                <Text style={styles.promptChipText}>{p.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
      <SyncBadge style={{ marginTop: 12 }} align="left" />
    </View>
  );

  const empty = !ready ? null : query ? (
    <Text style={styles.noResults}>{fmt(t.diaryNoResults, { q: query })}</Text>
  ) : (
    <View style={styles.empty}>
      <IllusPlaceholder tone="lilac" label="diario" size={96} radius={24} />
      <Text style={styles.emptyTitle}>{t.diaryEmptyTitle}</Text>
      <Text style={styles.emptyBody}>{t.diaryEmptyBody}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <TopBar title={t.diaryJournalTitle} onBack={() => navigation.goBack()} right={<View style={{ width: 36 }} />} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => {
          const prompt = promptFor(t, item.promptKey);
          const excerpt = item.body.replace(/\s+/g, ' ').slice(0, 140);
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('JournalEntry', { id: item.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title || prompt?.title || t.diaryUntitled}
                </Text>
                <Text style={styles.cardExcerpt} numberOfLines={2}>{excerpt}</Text>
                <Text style={styles.cardMeta}>
                  {timeLabel(item.createdAt, lang)}
                  {prompt && item.title ? ` · ${prompt.title}` : ''}
                </Text>
              </View>
              {item.mood != null && <MoodFace level={item.mood} size={32} />}
            </TouchableOpacity>
          );
        }}
      />
      <View style={[styles.fabWrap, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton onPress={() => navigation.navigate('JournalEditor', {})}>
          {t.diaryNewEntry}
        </PrimaryButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 16 },
  headerWrap: { paddingBottom: 6 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.bgCard, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4,
    ...SHADOW,
  },
  searchInput: { flex: 1, fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink, paddingVertical: 10 },
  clear: { fontFamily: FONTS.extraBold, fontSize: 20, color: COLORS.inkMuted, paddingHorizontal: 4 },
  promptsHeader: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink, marginTop: 18, marginBottom: 10 },
  promptChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.bgCard, borderRadius: 16, paddingVertical: 8, paddingLeft: 8, paddingRight: 14,
    ...SHADOW,
  },
  promptChipText: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.ink },
  sectionTitle: {
    fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.inkSoft,
    marginTop: 18, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.bgCard, borderRadius: 18, padding: 16, marginBottom: 10,
    ...SHADOW,
  },
  cardTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink },
  cardExcerpt: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft, lineHeight: 18, marginTop: 4 },
  cardMeta: { fontFamily: FONTS.uiMedium, fontSize: 11, color: COLORS.inkMuted, marginTop: 8 },
  noResults: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.inkSoft, textAlign: 'center', marginTop: 32 },
  empty: { alignItems: 'center', paddingTop: 36, paddingHorizontal: 16, gap: 10 },
  emptyTitle: { fontFamily: FONTS.extraBold, fontSize: 20, color: COLORS.ink, marginTop: 8, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.inkSoft, lineHeight: 20, textAlign: 'center' },
  fabWrap: { position: 'absolute', left: 24, right: 24, bottom: 0 },
});
