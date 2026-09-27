import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import Header from '../components/social/Header';
import Avatar from '../components/social/Avatar';
import Sheet from '../components/social/Sheet';
import Text from '../ui/Text';
import Button from '../ui/Button';
import { TextField } from '../ui/TextField';
import { ListSection, ListRow } from '../ui';
import { errorText, fmt, monthYear } from '../components/social/format';
import { useApp } from '../context/AppContext';
import { useSocial } from '../context/SocialContext';
import { deleteAccount } from '../data/session';
import { getMessageSettings, setMessageEnabled } from '../data/messages';
import { COLORS, RADIUS, SPACING } from '../theme';
import { showAlert } from '../components/dialogs';

/**
 * Mi perfil, como la pantalla de Ajustes de iOS (§5): cabecera con avatar y
 * alias, y listas agrupadas (`ListSection`/`ListRow`) para lo de comunidad y
 * lo de la cuenta. Cerrar sesión y eliminar cuenta se distinguen en rojo.
 *
 * H10 de la auditoría: la fila que abre la vista pública se llama "Ver mi
 * perfil público" (no "Perfil", que ya es el título de esta pantalla).
 */
export default function ProfileScreen({ navigation }) {
  const { t, lang, toggleLang, userEmail, memberSince, streak, entries, sessionToken, logout, syncStatus } = useApp();
  const { isV1, me, unread, showToast } = useSocial();
  const [deleting, setDeleting] = useState(false);
  // Cerrar sesión intenta subir lo pendiente hasta 8 s antes de irse: sin
  // indicador, sin red, el botón parecía no hacer nada durante ese tiempo.
  const [loggingOut, setLoggingOut] = useState(false);

  // Interruptor "Recibir mensajes" (apagado por defecto — ver
  // supabase/migrations/20260927000001_direct_messages.sql). Con servidor v1
  // la fila entera se oculta más abajo, así que ni se pide.
  const [messagesEnabled, setMessagesEnabledState] = useState(false);
  const [messagesToggling, setMessagesToggling] = useState(false);
  useEffect(() => {
    if (isV1) return;
    let cancelled = false;
    getMessageSettings(sessionToken).then((r) => { if (!cancelled) setMessagesEnabledState(r.enabled); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isV1, sessionToken]);

  const toggleMessages = async (next) => {
    if (messagesToggling) return;
    setMessagesToggling(true);
    const prev = messagesEnabled;
    setMessagesEnabledState(next);
    try {
      await setMessageEnabled(sessionToken, next);
    } catch (e) {
      setMessagesEnabledState(prev);
      showToast(errorText(e, t));
    } finally {
      setMessagesToggling(false);
    }
  };

  const alias = me?.displayName ?? null;
  const joined = me?.createdAt ?? memberSince;
  const avatarAuthor = alias || me?.avatarEmoji
    ? { displayName: alias ?? (userEmail ?? '?'), avatarEmoji: me?.avatarEmoji, avatarColor: me?.avatarColor }
    : null;

  const doLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  // Salir no borra lo que no alcanzó a subir (queda en este teléfono, en el
  // espacio de la cuenta), pero la persona tiene que saberlo antes de irse.
  const handleLogout = () => {
    if (!syncStatus?.pending) return doLogout();
    showAlert(t.logoutPendingTitle, t.logoutPendingBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.logoutPendingConfirm, style: 'destructive', onPress: doLogout },
    ]);
  };

  return (
    <View style={styles.container}>
      <Header title={t.profileTitle} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.identity} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.8}>
          <Avatar author={avatarAuthor} size={88} />
          <Text variant="title2" color={alias ? COLORS.label : COLORS.accent} style={styles.name}>{alias ?? t.socSetAlias}</Text>
          {me?.bio ? <Text variant="subhead" color={COLORS.secondaryLabel} style={styles.bio}>{me.bio}</Text> : null}
          <Text variant="footnote" color={COLORS.secondaryLabel}>{userEmail ?? t.noSession}</Text>
          {joined ? <Text variant="footnote" color={COLORS.tertiaryLabel}>{fmt(t.socMemberSince, { date: monthYear(joined, lang) })}</Text> : null}
          <View style={styles.editChip}><Text variant="footnote" color={COLORS.accent}>{t.socEditProfile}</Text></View>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text variant="title1" color={COLORS.accent}>{streak}</Text>
            <Text variant="caption1" color={COLORS.secondaryLabel}>{t.streakLabel}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text variant="title1" color={COLORS.accent}>{entries.length}</Text>
            <Text variant="caption1" color={COLORS.secondaryLabel}>{t.entriesLabel}</Text>
          </View>
        </View>

        <ListSection title={t.socSectionCommunity}>
          {!isV1 ? (
            <ListRow icon="notifications-outline" label={t.socNotifTitle} value={unread > 0 ? String(unread) : undefined} onPress={() => navigation.navigate('Notifications')} />
          ) : null}
          {!isV1 ? <ListRow icon="mail-outline" iconColor={COLORS.accent} label={t.socMessagesTitle} onPress={() => navigation.navigate('Messages')} /> : null}
          {me?.publicId ? (
            <ListRow icon="person-circle-outline" iconColor={COLORS.accent} label={t.socViewPublicProfile} onPress={() => navigation.navigate('UserProfile', { publicId: me.publicId })} />
          ) : null}
          <ListRow icon="document-text-outline" label={t.socMyPosts} onPress={() => navigation.navigate('MyPosts')} />
          {!isV1 ? <ListRow icon="bookmark-outline" label={t.socSavedPosts} onPress={() => navigation.navigate('SavedPosts')} /> : null}
          {!isV1 ? <ListRow icon="hand-left-outline" iconColor={COLORS.tones.sun.ink} label={t.socBlockedUsers} onPress={() => navigation.navigate('BlockedUsers')} /> : null}
          <ListRow icon="shield-checkmark-outline" iconColor={COLORS.tones.mint.ink} label={t.socGuidelines} onPress={() => navigation.navigate('CommunityGuidelines')} />
        </ListSection>

        {!isV1 ? (
          <ListSection footer={t.socMessagesEnableFooter}>
            <ListRow
              icon="chatbubble-ellipses-outline"
              iconColor={COLORS.accent}
              label={t.socMessagesEnableRow}
              switchValue={messagesEnabled}
              onSwitchChange={toggleMessages}
              accessibilityLabel={t.socMessagesEnableRow}
            />
          </ListSection>
        ) : null}

        <ListSection title={t.socSectionAccount}>
          <ListRow icon="globe-outline" label={t.socLanguage} value={t.socLanguageValue} onPress={toggleLang} />
          <ListRow icon="person-outline" label={t.socEditProfile} onPress={() => navigation.navigate('EditProfile')} />
          {!isV1 ? <ListRow icon="trash-outline" iconColor={COLORS.destructive} label={t.socDeleteAccount} destructive onPress={() => setDeleting(true)} /> : null}
        </ListSection>

        <TouchableOpacity
          style={[styles.logoutBtn, loggingOut && { opacity: 0.6 }]}
          activeOpacity={0.7}
          onPress={handleLogout}
          disabled={loggingOut}
          accessibilityRole="button"
          accessibilityState={{ busy: loggingOut, disabled: loggingOut }}
        >
          {loggingOut ? <ActivityIndicator color={COLORS.secondaryLabel} /> : <Text variant="headline" color={COLORS.destructive}>{t.logOut}</Text>}
        </TouchableOpacity>
      </ScrollView>

      <DeleteAccountSheet
        visible={deleting}
        onClose={() => setDeleting(false)}
        onDeleted={async () => {
          setDeleting(false);
          await logout();
          showAlert(t.socDeleteAccount, t.socDeleteAccountDone);
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }}
        token={sessionToken}
      />
    </View>
  );
}

/**
 * Confirmación fuerte: hay que escribir la palabra exacta. Explica qué se
 * borra en el servidor y qué se queda en el teléfono.
 */
function DeleteAccountSheet({ visible, onClose, onDeleted, token }) {
  const { t } = useApp();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (visible) { setTyped(''); setError(null); setBusy(false); } }, [visible]);

  const word = t.socDeleteWord;
  const ok = typed.trim().toUpperCase() === word;

  const confirm = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(token);
      await onDeleted();
    } catch (e) {
      setError(errorText(e, t));
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={busy ? () => {} : onClose} title={t.socDeleteAccountTitle}>
      <Text variant="body" style={styles.sheetBody}>{t.socDeleteAccountBody}</Text>
      <Text variant="footnote" color={COLORS.secondaryLabel} style={styles.sheetNote}>{t.socDeleteAccountLocal}</Text>
      <Text variant="subhead" style={styles.sheetLabel}>{fmt(t.socDeleteAccountType, { word })}</Text>
      <TextField
        value={typed}
        onChangeText={setTyped}
        placeholder={word}
        autoCapitalize="characters"
        autoCorrect={false}
        style={styles.sheetInput}
        editable={!busy}
      />
      {error ? <Text variant="footnote" color={COLORS.destructive} style={styles.sheetError}>{error}</Text> : null}
      <Button variant="filled" style={[styles.deleteBtn, (!ok || busy) && { opacity: 0.45 }]} disabled={!ok || busy} loading={busy} onPress={confirm}>
        {t.socDeleteAccountConfirm}
      </Button>
      <Button variant="plain" onPress={onClose} disabled={busy}>{t.socCancel}</Button>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.xxxl },
  identity: { alignItems: 'center', gap: 4 },
  name: { marginTop: SPACING.sm },
  bio: { textAlign: 'center', lineHeight: 19, paddingHorizontal: SPACING.md },
  editChip: { marginTop: SPACING.sm, backgroundColor: COLORS.accentTint, borderRadius: RADIUS.pill, paddingVertical: 6, paddingHorizontal: SPACING.md },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.xl,
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, paddingVertical: SPACING.md,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: COLORS.separator },
  logoutBtn: {
    marginTop: SPACING.sm, backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, padding: SPACING.md,
    alignItems: 'center',
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  sheetBody: { lineHeight: 21 },
  sheetNote: { lineHeight: 17, marginTop: SPACING.sm },
  sheetLabel: { marginTop: SPACING.md },
  sheetInput: { marginTop: SPACING.xs, letterSpacing: 1 },
  sheetError: { marginTop: SPACING.xs },
  deleteBtn: { backgroundColor: COLORS.destructive, marginTop: SPACING.md },
});
