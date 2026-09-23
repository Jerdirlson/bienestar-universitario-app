import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import TopBar from '../../components/TopBar';
import { StateView } from '../../components/social/ui';
import { errorText, fmt, locale } from '../../components/social/format';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import { listBlocks, unblock } from '../../data/users';
import { COLORS, FONTS, RADIUS } from '../../theme';

/**
 * Personas bloqueadas. La etiqueta es el alias (si se bloqueó desde un perfil
 * con nombre) o un extracto de lo que motivó el bloqueo si era anónimo: nunca
 * el alias de un autor anónimo — eso lo garantiza el servidor.
 */
export default function BlockedUsersScreen({ navigation }) {
  const { t, lang, sessionToken } = useApp();
  const { isV1, emit, showToast } = useSocial();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try { setBlocks(await listBlocks(sessionToken)); } catch (e) { setError(e); } finally { setLoading(false); }
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  const confirmUnblock = (b) => {
    Alert.alert(t.socUnblockTitle, t.socUnblockBody, [
      { text: t.socCancel, style: 'cancel' },
      {
        text: t.socUnblock,
        onPress: async () => {
          try {
            await unblock(sessionToken, b.id);
            setBlocks(prev => prev.filter(x => x.id !== b.id));
            emit({ type: 'blocked' });
            showToast(t.socDone);
          } catch (e) {
            Alert.alert(t.socErrTitle, errorText(e, t));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <TopBar title={t.socBlockedUsers} onBack={() => navigation.goBack()} right={<View style={{ width: 36 }} />} />
      <FlatList
        data={blocks}
        keyExtractor={(b) => String(b.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={!isV1 ? <Text style={styles.intro}>{t.socBlockedIntro}</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.label} numberOfLines={2}>{item.label || t.socAnonymous}</Text>
              {item.createdAt ? (
                <Text style={styles.date}>{fmt(t.socBlockedAt, { date: new Date(item.createdAt).toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' }) })}</Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.btn} onPress={() => confirmUnblock(item)}>
              <Text style={styles.btnText}>{t.socUnblock}</Text>
            </TouchableOpacity>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<StateView loading={loading} error={error ? errorText(error, t) : null} empty={isV1 ? t.socUnavailableV1 : t.socBlockedEmpty} onRetry={load} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  intro: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft, lineHeight: 19, marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 14 },
  label: { fontFamily: FONTS.uiSemiBold, fontSize: 14, color: COLORS.ink },
  date: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted },
  btn: { borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: COLORS.primary, paddingVertical: 7, paddingHorizontal: 14 },
  btnText: { fontFamily: FONTS.uiBold, fontSize: 12, color: COLORS.primary },
});
