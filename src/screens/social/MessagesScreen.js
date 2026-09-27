import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/social/Header';
import Avatar from '../../components/social/Avatar';
import { StateView } from '../../components/social/ui';
import Text from '../../ui/Text';
import SegmentedControl from '../../ui/SegmentedControl';
import { usePaged } from '../../components/social/hooks';
import { errorText, timeAgo, fmt } from '../../components/social/format';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import { listConversations, listMessageRequests } from '../../data/messages';
import { COLORS, RADIUS, SPACING } from '../../theme';

/**
 * "Mensajes": conversaciones aceptadas y solicitudes pendientes, en dos
 * pestañas (SegmentedControl, §5). El icono de la cabecera de Comunidad trae
 * aquí (junto a Notificaciones); ver CommunityScreen.
 */
export default function MessagesScreen({ navigation }) {
  const { t, lang, sessionToken } = useApp();
  const { refreshUnreadMessages } = useSocial();
  const [tab, setTab] = useState('conversations');

  const fetchConversations = useCallback(async (cursor) => {
    const r = await listConversations(sessionToken, { before: cursor ?? undefined });
    return { items: r.conversations, next: r.next };
  }, [sessionToken]);
  const convList = usePaged(fetchConversations, [fetchConversations]);

  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState(null);
  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      setRequests((await listMessageRequests(sessionToken)).requests);
    } catch (e) {
      setRequestsError(e);
    } finally {
      setRequestsLoading(false);
    }
  }, [sessionToken]);

  useFocusEffect(useCallback(() => {
    convList.refresh();
    loadRequests();
    refreshUnreadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRequests, refreshUnreadMessages]));

  const openConversation = (conv) => navigation.navigate('Chat', { conversationId: conv.id, other: conv.other, status: conv.status });

  const renderConversation = ({ item }) => (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openConversation(item)} accessibilityRole="button">
      <Avatar author={item.other} size={52} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.rowTop}>
          <Text variant="headline" numberOfLines={1} style={{ flex: 1 }}>{item.other?.displayName ?? t.socAnonymous}</Text>
          {item.lastMessage?.createdAt ? (
            <Text variant="caption1" color={COLORS.tertiaryLabel}>{timeAgo(item.lastMessage.createdAt, t, lang)}</Text>
          ) : null}
        </View>
        <Text variant="subhead" color={item.unreadCount > 0 ? COLORS.label : COLORS.secondaryLabel} numberOfLines={1}>
          {item.lastMessage
            ? (item.lastMessage.removed ? t.socMessageRemoved : `${item.lastMessage.isOwn ? `${t.socYou}: ` : ''}${item.lastMessage.body ?? ''}`)
            : ''}
        </Text>
      </View>
      {item.unreadCount > 0 ? (
        <View style={styles.unreadDot}>
          <Text variant="caption2" color="#fff" allowFontScaling={false}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  const renderRequest = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('Chat', { conversationId: item.id, other: item.other, status: 'pending' })}
      accessibilityRole="button"
    >
      <Avatar author={item.other} size={52} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" numberOfLines={1}>{fmt(t.socMessageRequestFrom, { name: item.other?.displayName ?? t.socAnonymous })}</Text>
        <Text variant="subhead" color={COLORS.secondaryLabel} numberOfLines={2}>{item.body}</Text>
      </View>
      <View style={styles.requestDot} />
    </TouchableOpacity>
  );

  const conversations = tab === 'conversations';

  return (
    <View style={styles.container}>
      <Header title={t.socMessagesTitle} onBack={() => navigation.goBack()} />
      <View style={styles.segmentWrap}>
        <SegmentedControl
          segments={[t.socMessagesTabConversations, requests.length > 0 ? `${t.socMessagesTabRequests} (${requests.length})` : t.socMessagesTabRequests]}
          selectedIndex={conversations ? 0 : 1}
          onChange={(i) => setTab(i === 0 ? 'conversations' : 'requests')}
        />
      </View>

      {conversations ? (
        <FlatList
          data={convList.items}
          keyExtractor={(c) => String(c.id)}
          renderItem={renderConversation}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          ListEmptyComponent={
            <StateView
              loading={convList.loading}
              error={convList.error ? errorText(convList.error, t, 'message') : null}
              empty={t.socMessagesEmpty}
              onRetry={convList.reload}
            />
          }
          ListFooterComponent={convList.loadingMore ? <ActivityIndicator style={{ marginVertical: SPACING.lg }} color={COLORS.accent} /> : null}
          onEndReached={convList.loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={convList.refreshing} onRefresh={convList.refresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />}
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(r) => String(r.id)}
          renderItem={renderRequest}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          ListEmptyComponent={
            <StateView
              loading={requestsLoading}
              error={requestsError ? errorText(requestsError, t, 'message') : null}
              empty={t.socRequestsEmpty}
              onRetry={loadRequests}
            />
          }
          refreshControl={<RefreshControl refreshing={false} onRefresh={loadRequests} tintColor={COLORS.accent} colors={[COLORS.accent]} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  segmentWrap: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, padding: SPACING.md,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  unreadDot: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
  },
  requestDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent },
});
