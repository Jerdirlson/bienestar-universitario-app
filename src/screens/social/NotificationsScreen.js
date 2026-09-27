import React, { useCallback, useEffect, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import Header from '../../components/social/Header';
import Avatar from '../../components/social/Avatar';
import { StateView } from '../../components/social/ui';
import Text from '../../ui/Text';
import { usePaged } from '../../components/social/hooks';
import { timeAgo, locale, REACTION_EMOJI } from '../../components/social/format';
import { notificationText } from '../../data/socialCore';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import { listNotifications, markNotificationsRead } from '../../data/notifications';
import { groupByDay } from '../../data/socialFormat';
import { API_URL } from '../../config';
import { COLORS, RADIUS, SPACING } from '../../theme';

// Solo la primera letra: textTransform 'capitalize' ponía "Lunes, 21 De Septiembre".
const capitalizeFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const SYSTEM_ICON = {
  post_approved: '✅', comment_approved: '✅',
  post_rejected: '📝', comment_rejected: '📝',
  post_hidden: '🕊️',
  support_sent: '💜',
  moderation_alert: '🚨',
};

// message_request / new_message SÍ traen actor (nunca son anónimos — ver
// API.md), así que usan el avatar como cualquier otra notificación con
// actor; no necesitan un ícono de sistema propio.

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
    // Protocolo de crisis (moderación v2): abre el SOS directo, nunca la
    // publicación — el aviso no lleva post_id ni comment_id a propósito.
    if (n.kind === 'support_sent') { navigation.navigate('Sos'); return; }
    // Alerta a moderadores: abre el panel de moderación en el navegador —
    // no hay pantalla nativa para eso, y el aviso no lleva post_id ni
    // comment_id a propósito (no delata qué quedó retenido).
    if (n.kind === 'moderation_alert') { Linking.openURL(`${API_URL}/panel`).catch(() => {}); return; }
    if (n.kind === 'message_request' || n.kind === 'new_message') {
      if (n.conversationId) navigation.navigate('Chat', { conversationId: n.conversationId, other: n.actor, status: n.kind === 'message_request' ? 'pending' : 'accepted' });
      return;
    }
    if (n.postId) navigation.navigate('PostDetail', { postId: n.postId });
  };

  const text = (n) => notificationText(n, t);

  const renderItem = ({ item }) => {
    if (item.type === 'header') return <Text variant="footnote" color={COLORS.secondaryLabel} style={styles.day}>{item.title}</Text>;
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
          <Text variant={n.read ? 'body' : 'headline'} style={{ lineHeight: 19 }}>{text(n)}</Text>
          {n.excerpt ? <Text variant="footnote" color={COLORS.secondaryLabel} numberOfLines={2}>“{n.excerpt}”</Text> : null}
          <Text variant="caption1" color={COLORS.tertiaryLabel}>{timeAgo(n.createdAt, t, lang)}</Text>
        </View>
        {!n.read ? <View style={styles.dot} /> : null}
      </TouchableOpacity>
    );
  };

  const hasUnread = list.items.some(n => !n.read);

  return (
    <View style={styles.container}>
      <Header
        title={t.socNotifTitle}
        onBack={() => navigation.goBack()}
        right={hasUnread ? (
          <TouchableOpacity onPress={markAll} hitSlop={8}>
            <Text variant="body" color={COLORS.accent}>{t.socMarkAllRead}</Text>
          </TouchableOpacity>
        ) : null}
      />
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
        ListFooterComponent={list.loadingMore ? <ActivityIndicator style={{ marginVertical: SPACING.lg }} color={COLORS.accent} /> : null}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl, gap: SPACING.sm },
  day: { marginTop: SPACING.md },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  unread: { backgroundColor: COLORS.accentTint },
  systemIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgElevated, alignItems: 'center', justifyContent: 'center' },
  reactionBadge: { position: 'absolute', right: -6, bottom: -4, fontSize: 15 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
});
