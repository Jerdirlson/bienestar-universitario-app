import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import Header from '../../components/social/Header';
import Avatar from '../../components/social/Avatar';
import PostCard from '../../components/social/PostCard';
import { StateView, MoreButton } from '../../components/social/ui';
import { OptionSheet } from '../../components/social/Sheet';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import { usePaged, usePostActions, usePostSync } from '../../components/social/hooks';
import { errorText, fmt, monthYear } from '../../components/social/format';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import { getUser, listUserPosts, followUser, unfollowUser, blockUser } from '../../data/users';
import { COLORS, SPACING } from '../../theme';
import { showAlert } from '../../components/dialogs';

/**
 * Perfil público (params { publicId }). Solo existe para quien eligió un
 * alias y solo lista lo que publicó con nombre: nada anónimo llega aquí.
 */
export default function UserProfileScreen({ route, navigation }) {
  const { t, lang, sessionToken } = useApp();
  const { emit, showToast } = useSocial();
  const publicId = route.params?.publicId;

  const [user, setUser] = useState(null);
  const [userError, setUserError] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [menu, setMenu] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      setUser(await getUser(sessionToken, publicId));
      setUserError(null);
    } catch (e) {
      setUserError(e);
    }
  }, [sessionToken, publicId]);

  useEffect(() => { if (publicId) loadUser(); else setUserError({ code: 'not_found' }); }, [publicId, loadUser]);

  const fetchPage = useCallback(async (cursor) => {
    const r = await listUserPosts(sessionToken, publicId, { before: cursor ?? undefined });
    return { items: r.posts, next: r.next };
  }, [sessionToken, publicId]);
  const list = usePaged(fetchPage, [fetchPage]);
  const update = useCallback((p) => list.setItems(prev => prev.map(x => (x.id === p.id ? p : x))), [list.setItems]);
  const remove = useCallback((id) => list.setItems(prev => prev.filter(x => x.id !== id)), [list.setItems]);
  const actions = usePostActions({ update, remove, onBlocked: () => navigation.goBack() });
  usePostSync(list.setItems);

  const toggleFollow = async () => {
    if (!user || followBusy) return;
    const doFollow = async (follow) => {
      setFollowBusy(true);
      const prev = user;
      setUser({ ...user, followedByMe: follow, followers: Math.max(0, user.followers + (follow ? 1 : -1)) });
      try {
        if (follow) await followUser(sessionToken, publicId);
        else await unfollowUser(sessionToken, publicId);
      } catch (e) {
        setUser(prev);
        showToast(errorText(e, t));
      } finally {
        setFollowBusy(false);
      }
    };
    if (user.followedByMe) {
      showAlert(t.socUnfollowTitle, user.displayName ?? '', [
        { text: t.socCancel, style: 'cancel' },
        { text: t.socUnfollowConfirm, style: 'destructive', onPress: () => doFollow(false) },
      ]);
    } else {
      doFollow(true);
    }
  };

  const confirmBlock = () => {
    showAlert(t.socBlockTitle, t.socBlockBody, [
      { text: t.socCancel, style: 'cancel' },
      {
        text: t.socBlockConfirm, style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(sessionToken, publicId);
            emit({ type: 'blocked' });
            showToast(t.socBlockDone);
            navigation.goBack();
          } catch (e) {
            showAlert(t.socErrTitle, errorText(e, t));
          }
        },
      },
    ]);
  };

  const renderItem = useCallback(({ item }) => (
    <PostCard
      post={item}
      v1={actions.v1}
      onOpen={actions.onOpen}
      onReact={actions.onReact}
      onToggleSave={actions.onToggleSave}
      onMenu={actions.onMenu}
    />
  ), [actions.v1, actions.onOpen, actions.onReact, actions.onToggleSave, actions.onMenu]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Header title={t.socProfileTitle} onBack={() => navigation.goBack()} />
        <StateView
          loading={!userError}
          error={userError ? (userError.code === 'not_found' ? t.socUserNotFound : errorText(userError, t)) : null}
          onRetry={userError?.code === 'not_found' ? undefined : loadUser}
        />
      </View>
    );
  }

  const header = (
    <View style={styles.headerCard}>
      <Avatar author={user} size={84} />
      <Text variant="title1" style={styles.name}>{user.displayName}</Text>
      {user.bio ? <Text variant="body" color={COLORS.secondaryLabel} style={styles.bio}>{user.bio}</Text> : null}
      {user.memberSince ? <Text variant="footnote" color={COLORS.tertiaryLabel}>{fmt(t.socMemberSince, { date: monthYear(user.memberSince, lang) })}</Text> : null}
      <View style={styles.stats}>
        <Stat value={user.postCount} label={t.socPostsCount} />
        <View style={styles.statDivider} />
        <Stat value={user.followers} label={t.socFollowers} />
        <View style={styles.statDivider} />
        <Stat value={user.following} label={t.socFollowingCount} />
      </View>
      {user.isMe ? (
        <>
          <Text variant="footnote" color={COLORS.secondaryLabel} style={styles.meNote}>{t.socThisIsYou}</Text>
          <Button variant="tinted" onPress={() => navigation.navigate('EditProfile')} style={styles.followBtn}>{t.socEditProfile}</Button>
        </>
      ) : (
        <Button
          variant={user.followedByMe ? 'tinted' : 'filled'}
          onPress={toggleFollow}
          disabled={followBusy}
          loading={followBusy}
          style={styles.followBtn}
          accessibilityLabel={user.followedByMe ? t.socFollowingBtn : t.socFollow}
        >
          {user.followedByMe ? t.socFollowingBtn : t.socFollow}
        </Button>
      )}
      <Text variant="title3" style={styles.sectionTitle}>{t.socPublicPosts}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header
        title={t.socProfileTitle}
        onBack={() => navigation.goBack()}
        right={!user.isMe ? <MoreButton onPress={() => setMenu(true)} label={t.socOptions} /> : null}
      />
      <FlatList
        data={list.items}
        keyExtractor={(p) => String(p.id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={<StateView loading={list.loading} error={list.error ? errorText(list.error, t) : null} empty={t.socUserPostsEmpty} onRetry={list.reload} />}
        ListFooterComponent={list.loadingMore ? <ActivityIndicator style={{ marginVertical: SPACING.lg }} color={COLORS.accent} /> : null}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
        contentContainerStyle={styles.content}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => { loadUser(); list.refresh(); }} tintColor={COLORS.accent} colors={[COLORS.accent]} />}
      />
      {actions.elements}
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        cancelLabel={t.socCancel}
        options={[{ key: 'block', label: t.socBlockAuthor, destructive: true, onPress: confirmBlock }]}
      />
    </View>
  );
}

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text variant="title3" color={COLORS.accent}>{value}</Text>
      <Text variant="caption1" color={COLORS.secondaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  headerCard: { alignItems: 'center', gap: 4, paddingBottom: SPACING.md },
  name: { marginTop: SPACING.xs },
  bio: { textAlign: 'center', lineHeight: 20, paddingHorizontal: SPACING.md },
  stats: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginTop: SPACING.md },
  statDivider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: COLORS.separator },
  stat: { alignItems: 'center', gap: 2 },
  meNote: { marginTop: SPACING.sm },
  followBtn: { alignSelf: 'stretch', marginTop: SPACING.md },
  sectionTitle: { alignSelf: 'flex-start', marginTop: SPACING.xl },
});
