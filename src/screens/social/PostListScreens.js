import React, { useCallback } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import TopBar from '../../components/TopBar';
import PostCard from '../../components/social/PostCard';
import { StateView } from '../../components/social/ui';
import { usePaged, usePostActions, usePostSync } from '../../components/social/hooks';
import { errorText } from '../../components/social/format';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import { listMyPosts, listSavedPosts } from '../../data/community';
import { COLORS } from '../../theme';

/** Lista de posts con paginación por `before`, reutilizada por Mis publicaciones y Guardados. */
function PostListScreen({ navigation, title, fetcher, emptyText, onlySaved = false, prependOwnCreated = false }) {
  const { t, sessionToken } = useApp();
  const { isV1 } = useSocial();

  const fetchPage = useCallback(async (cursor) => {
    const r = await fetcher(sessionToken, { before: cursor ?? undefined });
    return { items: r.posts, next: r.next };
  }, [sessionToken, fetcher]);
  const list = usePaged(fetchPage, [fetchPage]);

  const update = useCallback((p) => list.setItems(prev => (
    onlySaved && !p.savedByMe ? prev.filter(x => x.id !== p.id) : prev.map(x => (x.id === p.id ? p : x))
  )), [list.setItems, onlySaved]);
  const remove = useCallback((id) => list.setItems(prev => prev.filter(x => x.id !== id)), [list.setItems]);
  const actions = usePostActions({ update, remove });
  usePostSync(list.setItems, {
    onBlocked: list.refresh,
    onCreated: prependOwnCreated ? (post) => list.setItems(prev => [post, ...prev.filter(p => p.id !== post.id)]) : undefined,
  });

  const renderItem = useCallback(({ item }) => (
    <PostCard
      post={item}
      v1={actions.v1}
      onOpen={item.status === 'published' || item.isOwn ? actions.onOpen : undefined}
      onAuthorPress={actions.onAuthorPress}
      onReact={actions.onReact}
      onToggleSave={actions.onToggleSave}
      onMenu={actions.onMenu}
      onSos={actions.onSos}
    />
  ), [actions.v1, actions.onOpen, actions.onAuthorPress, actions.onReact, actions.onToggleSave, actions.onMenu, actions.onSos]);

  return (
    <View style={styles.container}>
      <TopBar title={title} onBack={() => navigation.goBack()} right={<View style={{ width: 36 }} />} />
      <FlatList
        data={list.items}
        keyExtractor={(p) => String(p.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <StateView
            loading={list.loading}
            error={list.error ? errorText(list.error, t) : null}
            empty={onlySaved && isV1 ? t.socUnavailableV1 : emptyText}
            onRetry={list.reload}
          />
        }
        ListFooterComponent={list.loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.primary} /> : null}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      />
      {actions.elements}
    </View>
  );
}

export function MyPostsScreen({ navigation }) {
  const { t } = useApp();
  return <PostListScreen navigation={navigation} title={t.socMyPosts} fetcher={listMyPosts} emptyText={t.socMyPostsEmpty} prependOwnCreated />;
}

export function SavedPostsScreen({ navigation }) {
  const { t } = useApp();
  return <PostListScreen navigation={navigation} title={t.socSavedPosts} fetcher={listSavedPosts} emptyText={t.socSavedEmpty} onlySaved />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
});
