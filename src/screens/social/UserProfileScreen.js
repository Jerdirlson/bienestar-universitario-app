import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import TopBar from '../../components/TopBar';
import Avatar from '../../components/social/Avatar';
import PostCard from '../../components/social/PostCard';
import { StateView, MoreButton } from '../../components/social/ui';
import { OptionSheet } from '../../components/social/Sheet';
import { usePaged, usePostActions, usePostSync } from '../../components/social/hooks';
import { errorText, fmt, monthYear } from '../../components/social/format';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import { getUser, listUserPosts, followUser, unfollowUser, blockUser } from '../../data/users';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../theme';
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
        <TopBar title={t.socProfileTitle} onBack={() => navigation.goBack()} right={<View style={{ width: 36 }} />} />
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
      {!user.isMe ? (
        <View style={styles.moreWrap}><MoreButton onPress={() => setMenu(true)} label={t.socOptions} /></View>
      ) : null}
      <Avatar author={user} size={84} />
      <Text style={styles.name}>{user.displayName}</Text>
      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
      {user.memberSince ? <Text style={styles.since}>{fmt(t.socMemberSince, { date: monthYear(user.memberSince, lang) })}</Text> : null}
      <View style={styles.stats}>
        <Stat value={user.postCount} label={t.socPostsCount} />
        <Stat value={user.followers} label={t.socFollowers} />
        <Stat value={user.following} label={t.socFollowingCount} />
      </View>
      {user.isMe ? (
        <>
          <Text style={styles.meNote}>{t.socThisIsYou}</Text>
          <TouchableOpacity style={[styles.followBtn, styles.following]} onPress={() => navigation.navigate('EditProfile')}>
            <Text style={[styles.followText, styles.followingText]}>{t.socEditProfile}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          style={[styles.followBtn, user.followedByMe && styles.following]}
          onPress={toggleFollow}
          disabled={followBusy}
          accessibilityRole="button"
          accessibilityState={{ selected: user.followedByMe }}
        >
          {followBusy ? <ActivityIndicator color={user.followedByMe ? COLORS.primary : '#fff'} /> : (
            <Text style={[styles.followText, user.followedByMe && styles.followingText]}>
              {user.followedByMe ? t.socFollowingBtn : t.socFollow}
            </Text>
          )}
        </TouchableOpacity>
      )}
      <Text style={styles.sectionTitle}>{t.socPublicPosts}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <TopBar title={t.socProfileTitle} onBack={() => navigation.goBack()} right={<View style={{ width: 36 }} />} />
      <FlatList
        data={list.items}
        keyExtractor={(p) => String(p.id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={<StateView loading={list.loading} error={list.error ? errorText(list.error, t) : null} empty={t.socUserPostsEmpty} onRetry={list.reload} />}
        ListFooterComponent={list.loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.primary} /> : null}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.content}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => { loadUser(); list.refresh(); }} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
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
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  headerCard: { alignItems: 'center', gap: 6, paddingBottom: 12 },
  moreWrap: { position: 'absolute', right: 0, top: 0, zIndex: 1 },
  name: { fontFamily: FONTS.black, fontSize: 22, color: COLORS.ink, marginTop: 6 },
  bio: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.inkSoft, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
  since: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkMuted },
  stats: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 10 },
  stat: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', ...SHADOW },
  statValue: { fontFamily: FONTS.black, fontSize: 20, color: COLORS.primary },
  statLabel: { fontFamily: FONTS.uiSemiBold, fontSize: 11, color: COLORS.inkSoft, marginTop: 2 },
  meNote: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, marginTop: 8 },
  followBtn: {
    alignSelf: 'stretch', marginTop: 12, backgroundColor: COLORS.primary, borderRadius: RADIUS.pill,
    paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.primary,
  },
  following: { backgroundColor: COLORS.bgCard },
  followText: { fontFamily: FONTS.extraBold, fontSize: 15, color: '#fff' },
  followingText: { color: COLORS.primary },
  sectionTitle: { alignSelf: 'flex-start', fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink, marginTop: 18 },
});
