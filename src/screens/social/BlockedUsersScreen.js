import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import Header from '../../components/social/Header';
import { StateView } from '../../components/social/ui';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import { errorText, fmt, locale } from '../../components/social/format';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import { listBlocks, unblock } from '../../data/users';
import { COLORS, RADIUS, SPACING } from '../../theme';
import { showAlert } from '../../components/dialogs';

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
    showAlert(t.socUnblockTitle, t.socUnblockBody, [
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
            showAlert(t.socErrTitle, errorText(e, t));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Header title={t.socBlockedUsers} onBack={() => navigation.goBack()} />
      <FlatList
        data={blocks}
        keyExtractor={(b) => String(b.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={!isV1 ? <Text variant="footnote" color={COLORS.secondaryLabel} style={styles.intro}>{t.socBlockedIntro}</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body" numberOfLines={2}>{item.label || t.socAnonymous}</Text>
              {item.createdAt ? (
                <Text variant="caption1" color={COLORS.tertiaryLabel}>{fmt(t.socBlockedAt, { date: new Date(item.createdAt).toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' }) })}</Text>
              ) : null}
            </View>
            <Button variant="tinted" onPress={() => confirmUnblock(item)} style={styles.btn}>{t.socUnblock}</Button>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        ListEmptyComponent={<StateView loading={loading} error={error ? errorText(error, t) : null} empty={isV1 ? t.socUnavailableV1 : t.socBlockedEmpty} onRetry={load} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={COLORS.accent} colors={[COLORS.accent]} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  intro: { lineHeight: 19, marginBottom: SPACING.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.md, padding: SPACING.md },
  btn: { paddingHorizontal: SPACING.md, minHeight: 44 },
});
