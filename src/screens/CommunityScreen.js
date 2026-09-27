import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, Animated, StyleSheet, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../ui/Text';
import Icon from '../ui/Icon';
import Chip from '../ui/Chip';
import SearchField from '../ui/SearchField';
import SegmentedControl from '../ui/SegmentedControl';
import PostCard from '../components/social/PostCard';
import Avatar from '../components/social/Avatar';
import { StateView } from '../components/social/ui';
import { usePaged, usePostActions, usePostSync } from '../components/social/hooks';
import { fmt } from '../components/social/format';
import { useApp } from '../context/AppContext';
import { useSocial } from '../context/SocialContext';
import { listPosts } from '../data/community';
import { TOPICS, LIMITS } from '../data/socialCore';
import { COLORS, RADIUS, SPACING } from '../theme';
import useKeyboardHeight from '../components/useKeyboardHeight';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Feed de la comunidad: título grande estilo Apple News/Threads, Para ti /
 * Siguiendo, temas, recientes/populares, búsqueda, paginación infinita y
 * pull-to-refresh. Lo propio pendiente se distingue con el borde/fondo de
 * estado de PostCard (H14 de la auditoría). Con servidor v1 se ocultan
 * pestañas y temas.
 */
export default function CommunityScreen({ navigation }) {
  const { t, sessionToken } = useApp();
  const { isV1, unread, me } = useSocial();
  const insets = useSafeAreaInsets();

  const [feed, setFeed] = useState('all');
  const [topic, setTopic] = useState(null);
  const [sort, setSort] = useState('recent');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  // El FAB de SOS es "absolute": con edge-to-edge (obligatorio desde el SDK
  // 55 de Expo) el teclado lo taparía y no se puede ocultar (regla "El SOS
  // siempre funciona", CLAUDE.md), así que se sube por encima del teclado.
  const keyboardHeight = useKeyboardHeight();

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
      onAppeal={actions.onAppeal}
    />
  ), [actions.v1, actions.onOpen, actions.onAuthorPress, actions.onReact, actions.onToggleSave, actions.onMenu, actions.onSos, actions.onAppeal]);

  const emptyText = q
    ? fmt(t.socSearchEmpty, { q })
    : effectiveFeed === 'following' ? t.socFeedEmptyFollowing : t.socFeedEmpty;

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text variant="largeTitle" style={styles.largeTitle}>{t.community}</Text>
        <View style={styles.titleActions}>
          {!isV1 ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={styles.iconCircle}
              accessibilityRole="button"
              accessibilityLabel={t.socNotifTitle}
            >
              <Icon name="notifications-outline" size={20} color={COLORS.label} />
              {unread > 0 ? (
                <View style={styles.badge}>
                  <Text variant="caption2" color="#fff" allowFontScaling={false}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={styles.iconCircle}
            accessibilityRole="button"
            accessibilityLabel={t.profileTitle}
          >
            <Avatar author={me?.avatarEmoji ? { avatarEmoji: me.avatarEmoji, avatarColor: me.avatarColor } : null} size={32} />
          </TouchableOpacity>
        </View>
      </View>
      <Text variant="subhead" color={COLORS.secondaryLabel} style={styles.subHeader}>{t.socCommunitySub}</Text>

      <TouchableOpacity style={styles.compose} onPress={() => navigation.navigate('Compose')} activeOpacity={0.8} accessibilityRole="button">
        <Avatar author={me?.avatarEmoji ? { avatarEmoji: me.avatarEmoji, avatarColor: me.avatarColor } : null} size={40} />
        <View style={{ flex: 1 }}>
          <Text variant="headline">{t.socComposeCta}</Text>
          <Text variant="footnote" color={COLORS.secondaryLabel}>{t.socComposeCtaSub}</Text>
        </View>
        <View style={styles.composeIcon}>
          <Icon name="add" size={18} color="#fff" />
        </View>
      </TouchableOpacity>

      {!isV1 ? (
        <SegmentedControl
          segments={[t.socFeedForYou, t.socFeedFollowing]}
          selectedIndex={feed === 'all' ? 0 : 1}
          onChange={(i) => setFeed(i === 0 ? 'all' : 'following')}
        />
      ) : null}

      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t.socSearchPlaceholder}
        onClear={() => { setQuery(''); setQ(''); }}
        clearAccessibilityLabel={t.socClose}
        returnKeyType="search"
        onSubmitEditing={() => setQ(query.trim())}
        maxLength={100}
      />

      <View style={styles.chipsRow}>
        <Chip selected={sort === 'recent'} onPress={() => setSort('recent')}>{t.socSortRecent}</Chip>
        <Chip selected={sort === 'popular'} onPress={() => setSort('popular')}>{t.socSortPopular}</Chip>
      </View>
      {!isV1 ? (
        <View style={styles.chipsRow}>
          <Chip selected={!topic} onPress={() => setTopic(null)}>{t.socAllTopics}</Chip>
          {TOPICS.map(k => (
            <Chip key={k} selected={topic === k} onPress={() => setTopic(topic === k ? null : k)}>{t.socTopics[k]}</Chip>
          ))}
        </View>
      ) : null}
    </View>
  );

  const footer = list.loadingMore
    ? <ActivityIndicator style={{ marginVertical: SPACING.lg }} color={COLORS.accent} />
    : (!list.loading && !list.hasMore && list.items.length > 3 ? <Text variant="footnote" color={COLORS.tertiaryLabel} style={styles.end}>{t.socEndOfFeed}</Text> : null);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />

      <AnimatedTouchable
        onPress={() => navigation.navigate('Sos')}
        style={[styles.sosFab, { transform: [{ translateY: Animated.multiply(keyboardHeight, -1) }] }]}
        accessibilityRole="button"
        accessibilityLabel={t.sos}
      >
        <Text variant="caption2" color="#fff" style={styles.sosFabText}>SOS</Text>
      </AnimatedTouchable>
      {actions.elements}
    </View>
  );
}

const Separator = () => <View style={{ height: SPACING.md }} />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 120 },
  header: { gap: SPACING.md, paddingTop: SPACING.xs, paddingBottom: SPACING.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  largeTitle: { flexShrink: 1 },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
    backgroundColor: COLORS.destructive, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.bg,
  },
  subHeader: { marginTop: -SPACING.xs },
  compose: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg,
    padding: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  composeIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  end: { textAlign: 'center', marginVertical: SPACING.xl },
  sosFab: {
    position: 'absolute', right: SPACING.lg, bottom: 96,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.sos,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.sos, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  sosFabText: { fontWeight: '800' },
});
