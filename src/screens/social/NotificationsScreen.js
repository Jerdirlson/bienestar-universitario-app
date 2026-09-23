import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import TopBar from '../../components/TopBar';
import Avatar from '../../components/social/Avatar';
import { StateView } from '../../components/social/ui';
import { usePaged } from '../../components/social/hooks';
import { fmt, timeAgo, locale, REACTION_EMOJI } from '../../components/social/format';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import { listNotifications, markNotificationsRead } from '../../data/notifications';
import { groupByDay } from '../../data/socialFormat';
import { COLORS, FONTS, RADIUS } from '../../theme';

// Solo la primera letra: textTransform 'capitalize' ponía "Lunes, 21 De Septiembre".
const capitalizeFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const SYSTEM_ICON = {
  post_approved: '✅', comment_approved: '✅',
  post_rejected: '📝', comment_rejected: '📝',
  post_hidden: '🕊️',
};

/**
 * Notificaciones, paginadas y agrupadas por día. Tocar una la marca leída y
 * lleva al post o al perfil. Con servidor v1 queda vacía, sin errores.
 */
export default function NotificationsScreen({ navigation }) {
  const { t, lang, sessionToken } = useApp();
  const { isV1, unread, setUnread, refreshUnread } = useSocial();

  const fetchPage = useCallback(async (cursor) => {
    const r = await listNotifications(sessionToken, { before: cursor ?? undefined });
    if (!cursor) setUnread(r.unread);
    return { items: r.notifications, next: r.next };
  }, [sessionToken, setUnread]);
  const list = usePaged(fetchPage, [fetchPage]);

  useEffect(() => () => { refreshUnread(); }, [refreshUnread]);

  const rows = useMemo(() => {
    const out = [];
    for (const section of groupByDay(list.items)) {
      const title = section.key === 'today' ? t.socToday
        : section.key === 'yesterday' ? t.socYesterday
          : capitalizeFirst(new Date(section.date).toLocaleDateString(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' }));
      out.push({ type: 'header', id: `h-${section.key}`, title });
      for (const n of section.items) out.push({ type: 'item', id: n.id, n });
    }
    return out;
  }, [list.items, t, lang]);

  const markLocal = (ids) => {
    list.setItems(prev => prev.map(n => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
  };

  const markAll = async () => {
    markLocal(null);
    setUnread(0);
    try { await markNotificationsRead(sessionToken); } catch { refreshUnread(); }
  };

  const open = (n) => {
    if (!n.read) {
      markLocal([n.id]);
      setUnread(Math.max(0, unread - 1));
      markNotificationsRead(sessionToken, [n.id]).catch(() => {});
    }
    if (n.kind === 'new_follower') {
      if (n.actor?.publicId) navigation.navigate('UserProfile', { publicId: n.actor.publicId });
      return;
    }
    if (n.kind === 'post_rejected') { navigation.navigate('MyPosts'); return; }
    if (n.postId) navigation.navigate('PostDetail', { postId: n.postId });
  };

  const text = (n) => {
    const tpl = t.socNotifKinds[n.kind] ?? t.socNotifKinds.other;
    return fmt(tpl, { name: n.actor?.displayName ?? t.socSomeone });
  };

  const renderItem = ({ item }) => {
    if (item.type === 'header') return <Text style={styles.day}>{item.title}</Text>;
    const n = item.n;
    const system = SYSTEM_ICON[n.kind];
    return (
      <TouchableOpacity style={[styles.item, !n.read && styles.unread]} onPress={() => open(n)} activeOpacity={0.75} accessibilityRole="button">
        {system ? (
          <View style={styles.systemIcon}><Text style={{ fontSize: 18 }}>{system}</Text></View>
        ) : (
          <View>
            <Avatar author={n.actor} size={40} />
            {n.reactionKind ? <Text style={styles.reactionBadge}>{REACTION_EMOJI[n.reactionKind]}</Text> : null}
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.text, !n.read && styles.textUnread]}>{text(n)}</Text>
          {n.excerpt ? <Text style={styles.excerpt} numberOfLines={2}>“{n.excerpt}”</Text> : null}
          <Text style={styles.time}>{timeAgo(n.createdAt, t, lang)}</Text>
        </View>
        {!n.read ? <View style={styles.dot} /> : null}
      </TouchableOpacity>
    );
  };

  const hasUnread = list.items.some(n => !n.read);

  return (
    <View style={styles.container}>
      <TopBar title={t.socNotifTitle} onBack={() => navigation.goBack()} right={<View style={{ width: 36 }} />} />
      {hasUnread ? (
        <TouchableOpacity style={styles.markAll} onPress={markAll}>
          <Text style={styles.markAllText}>{t.socMarkAllRead}</Text>
        </TouchableOpacity>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <StateView
            loading={list.loading}
            error={list.error ? t.socNotifError : null}
            empty={isV1 ? t.socUnavailableV1 : t.socNotifEmpty}
            onRetry={list.reload}
          />
        }
        ListFooterComponent={list.loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.primary} /> : null}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  markAll: { alignSelf: 'flex-end', marginRight: 16, marginBottom: 4, paddingVertical: 6 },
  markAllText: { fontFamily: FONTS.uiBold, fontSize: 13, color: COLORS.primary },
  day: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.inkSoft, marginTop: 12 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md, padding: 12,
  },
  unread: { backgroundColor: COLORS.primarySoft },
  systemIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  reactionBadge: { position: 'absolute', right: -6, bottom: -4, fontSize: 15 },
  text: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink, lineHeight: 19 },
  textUnread: { fontFamily: FONTS.uiSemiBold },
  excerpt: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, lineHeight: 17 },
  time: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
});
