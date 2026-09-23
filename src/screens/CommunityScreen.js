import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import TopBar from '../components/TopBar';
import PostCard from '../components/social/PostCard';
import Avatar from '../components/social/Avatar';
import { StateView, TopicChips, Segmented, BellButton, Pill } from '../components/social/ui';
import { usePaged, usePostActions, usePostSync } from '../components/social/hooks';
import { fmt } from '../components/social/format';
import { useApp } from '../context/AppContext';
import { useSocial } from '../context/SocialContext';
import { listPosts } from '../data/community';
import { TOPICS, LIMITS } from '../data/socialCore';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';

/**
 * Feed de la comunidad: Para ti / Siguiendo, temas, recientes/populares,
 * búsqueda, paginación infinita y pull-to-refresh. Lo propio pendiente se ve
 * con su insignia y explicación. Con servidor v1 se ocultan pestañas y temas.
 */
export default function CommunityScreen({ navigation }) {
  const { t, sessionToken } = useApp();
  const { isV1, unread, me } = useSocial();

  const [feed, setFeed] = useState('all');
  const [topic, setTopic] = useState(null);
  const [sort, setSort] = useState('recent');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');

  // Búsqueda con pausa: no dispara una petición por tecla.
  useEffect(() => {
    const id = setTimeout(() => setQ(query.trim()), 400);
    return () => clearTimeout(id);
  }, [query]);

  // Badge en la pestaña Comunidad (TabBar lo lee de options.tabBarBadge).
  useLayoutEffect(() => {
    navigation.setOptions?.({ tabBarBadge: unread > 0 ? unread : undefined });
  }, [navigation, unread]);

  const effectiveFeed = isV1 ? 'all' : feed;
  const effectiveTopic = isV1 ? null : topic;

  const fetchPage = useCallback(async (cursor) => {
    if (!sessionToken) return { items: [], next: null };
    const r = await listPosts(sessionToken, {
      feed: effectiveFeed, topic: effectiveTopic, sort, q,
      before: sort === 'popular' ? undefined : cursor ?? undefined,
      offset: sort === 'popular' ? cursor ?? 0 : undefined,
      limit: LIMITS.pageSize,
    });
    return { items: r.posts, next: r.next };
  }, [sessionToken, effectiveFeed, effectiveTopic, sort, q]);

  const list = usePaged(fetchPage, [fetchPage]);
  const update = useCallback((p) => list.setItems(prev => prev.map(x => (x.id === p.id ? p : x))), [list.setItems]);
  const remove = useCallback((id) => list.setItems(prev => prev.filter(x => x.id !== id)), [list.setItems]);
  const actions = usePostActions({ update, remove });

  usePostSync(list.setItems, {
    onBlocked: list.refresh,
    onCreated: (post) => list.setItems(prev => [post, ...prev.filter(p => p.id !== post.id)]),
  });

  const renderItem = useCallback(({ item }) => (
    <PostCard
      post={item}
      v1={actions.v1}
      onOpen={actions.onOpen}
      onAuthorPress={actions.onAuthorPress}
      onReact={actions.onReact}
      onToggleSave={actions.onToggleSave}
      onMenu={actions.onMenu}
      onSos={actions.onSos}
    />
  ), [actions.v1, actions.onOpen, actions.onAuthorPress, actions.onReact, actions.onToggleSave, actions.onMenu, actions.onSos]);

  const emptyText = q
    ? fmt(t.socSearchEmpty, { q })
    : effectiveFeed === 'following' ? t.socFeedEmptyFollowing : t.socFeedEmpty;

  const header = (
    <View style={styles.header}>
      <Text style={styles.subHeader}>{t.socCommunitySub}</Text>

      <TouchableOpacity style={styles.compose} onPress={() => navigation.navigate('Compose')} activeOpacity={0.8} accessibilityRole="button">
        <Avatar author={me?.avatarEmoji ? { avatarEmoji: me.avatarEmoji, avatarColor: me.avatarColor } : null} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.composeTitle}>{t.socComposeCta}</Text>
          <Text style={styles.composeSub}>{t.socComposeCtaSub}</Text>
        </View>
        <View style={styles.composeIcon}>
          <Svg width="14" height="14" viewBox="0 0 16 16"><Path d="M8 2v12M2 8h12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /></Svg>
        </View>
      </TouchableOpacity>

      {!isV1 ? (
        <Segmented
          value={feed}
          onChange={setFeed}
          options={[{ value: 'all', label: t.socFeedForYou }, { value: 'following', label: t.socFeedFollowing }]}
        />
      ) : null}

      <View style={styles.search}>
        <Svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <Circle cx="7" cy="7" r="5" stroke={COLORS.inkMuted} strokeWidth="1.6" />
          <Path d="M11 11l3.5 3.5" stroke={COLORS.inkMuted} strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.socSearchPlaceholder}
          placeholderTextColor={COLORS.inkMuted}
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => setQ(query.trim())}
          maxLength={100}
        />
        {query ? (
          <TouchableOpacity onPress={() => { setQuery(''); setQ(''); }} hitSlop={10} accessibilityLabel={t.socClose}>
            <Svg width="12" height="12" viewBox="0 0 16 16"><Path d="M2 2l12 12M14 2L2 14" stroke={COLORS.inkMuted} strokeWidth="2.2" strokeLinecap="round" /></Svg>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        <Pill small label={t.socSortRecent} selected={sort === 'recent'} onPress={() => setSort('recent')} />
        <Pill small label={t.socSortPopular} selected={sort === 'popular'} onPress={() => setSort('popular')} />
      </View>
      {!isV1 ? (
        <TopicChips topics={TOPICS} labels={t.socTopics} allLabel={t.socAllTopics} value={topic} onChange={setTopic} />
      ) : null}
    </View>
  );

  const footer = list.loadingMore
    ? <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.primary} />
    : (!list.loading && !list.hasMore && list.items.length > 3 ? <Text style={styles.end}>{t.socEndOfFeed}</Text> : null);

  return (
    <View style={styles.container}>
      <TopBar
        title={t.community}
        extra={!isV1 ? <BellButton count={unread} label={t.socNotifTitle} onPress={() => navigation.navigate('Notifications')} /> : null}
      />
      <FlatList
        data={list.items}
        keyExtractor={(p) => String(p.id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <StateView
            loading={list.loading}
            error={list.error ? (list.error.code === 'sin_conexion' ? t.socErrOffline : t.socFeedError) : null}
            empty={emptyText}
            onRetry={list.reload}
          />
        }
        ListFooterComponent={footer}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity onPress={() => navigation.navigate('Sos')} style={styles.sosFab} accessibilityRole="button" accessibilityLabel={t.sos}>
        <Text style={styles.sosFabText}>SOS</Text>
      </TouchableOpacity>
      {actions.elements}
    </View>
  );
}

const Separator = () => <View style={{ height: 12 }} />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 16, paddingBottom: 120 },
  header: { gap: 12, paddingTop: 4, paddingBottom: 14 },
  subHeader: { fontFamily: FONTS.uiSemiBold, fontSize: 13, color: COLORS.inkSoft },
  compose: {
    backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.lg,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  composeIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  composeTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink },
  composeSub: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, marginTop: 1 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.pill, paddingHorizontal: 14, ...SHADOW, shadowOpacity: 0.04, elevation: 1,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink },
  filterRow: { flexDirection: 'row', gap: 8 },
  end: { fontFamily: FONTS.uiSemiBold, fontSize: 13, color: COLORS.inkMuted, textAlign: 'center', marginVertical: 20 },
  sosFab: {
    position: 'absolute', right: 16, bottom: 96,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#F37171',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F37171', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  sosFabText: { fontFamily: FONTS.black, fontSize: 12, color: '#fff' },
});
