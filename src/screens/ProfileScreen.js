import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import TopBar from '../components/TopBar';
import Avatar from '../components/social/Avatar';
import Sheet from '../components/social/Sheet';
import { MenuRow } from '../components/social/ui';
import { errorText, fmt, monthYear } from '../components/social/format';
import { useApp } from '../context/AppContext';
import { useSocial } from '../context/SocialContext';
import { deleteAccount } from '../data/session';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';

/**
 * Mi perfil: identidad en la comunidad (alias, avatar, bio), lo del diario
 * que ya mostraba (racha y registros), accesos a lo mío, idioma, cerrar
 * sesión y eliminar la cuenta con confirmación fuerte.
 */
export default function ProfileScreen({ navigation }) {
  const { t, lang, toggleLang, userEmail, memberSince, streak, entries, sessionToken, logout, syncStatus } = useApp();
  const { isV1, me, unread } = useSocial();
  const [deleting, setDeleting] = useState(false);

  const alias = me?.displayName ?? null;
  const joined = me?.createdAt ?? memberSince;
  const avatarAuthor = alias || me?.avatarEmoji
    ? { displayName: alias ?? (userEmail ?? '?'), avatarEmoji: me?.avatarEmoji, avatarColor: me?.avatarColor }
    : null;

  const doLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  // Salir no borra lo que no alcanzó a subir (queda en este teléfono, en el
  // espacio de la cuenta), pero la persona tiene que saberlo antes de irse.
  const handleLogout = () => {
    if (!syncStatus?.pending) return doLogout();
    Alert.alert(t.logoutPendingTitle, t.logoutPendingBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.logoutPendingConfirm, style: 'destructive', onPress: doLogout },
    ]);
  };

  return (
    <View style={styles.container}>
      <TopBar title={t.profileTitle} onBack={() => navigation.goBack()} right={<View style={{ width: 36 }} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.identity} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.8}>
          <Avatar author={avatarAuthor} size={88} />
          <Text style={[styles.name, !alias && { color: COLORS.primary }]}>{alias ?? t.socSetAlias}</Text>
          {me?.bio ? <Text style={styles.bio}>{me.bio}</Text> : null}
          <Text style={styles.email}>{userEmail ?? t.noSession}</Text>
          {joined ? <Text style={styles.since}>{fmt(t.socMemberSince, { date: monthYear(joined, lang) })}</Text> : null}
          <View style={styles.editChip}><Text style={styles.editChipText}>{t.socEditProfile}</Text></View>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>{t.streakLabel}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{entries.length}</Text>
            <Text style={styles.statLabel}>{t.entriesLabel}</Text>
          </View>
        </View>

        <Text style={styles.section}>{t.socSectionCommunity}</Text>
        <View style={styles.group}>
          {!isV1 ? <MenuRow label={t.socNotifTitle} badge={unread} onPress={() => navigation.navigate('Notifications')} /> : null}
          {me?.publicId ? <MenuRow label={t.socProfileTitle} onPress={() => navigation.navigate('UserProfile', { publicId: me.publicId })} /> : null}
          <MenuRow label={t.socMyPosts} onPress={() => navigation.navigate('MyPosts')} />
          {!isV1 ? <MenuRow label={t.socSavedPosts} onPress={() => navigation.navigate('SavedPosts')} /> : null}
          {!isV1 ? <MenuRow label={t.socBlockedUsers} onPress={() => navigation.navigate('BlockedUsers')} /> : null}
          <MenuRow label={t.socGuidelines} onPress={() => navigation.navigate('CommunityGuidelines')} last />
        </View>

        <Text style={styles.section}>{t.socSectionAccount}</Text>
        <View style={styles.group}>
          <MenuRow label={t.socLanguage} value={t.socLanguageValue} onPress={toggleLang} />
          <MenuRow label={t.socEditProfile} onPress={() => navigation.navigate('EditProfile')} last={isV1} />
          {!isV1 ? <MenuRow label={t.socDeleteAccount} destructive onPress={() => setDeleting(true)} last /> : null}
        </View>

        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.7} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>{t.logOut}</Text>
        </TouchableOpacity>
      </ScrollView>

      <DeleteAccountSheet
        visible={deleting}
        onClose={() => setDeleting(false)}
        onDeleted={async () => {
          setDeleting(false);
          await logout();
          Alert.alert(t.socDeleteAccount, t.socDeleteAccountDone);
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
      <Text style={styles.sheetBody}>{t.socDeleteAccountBody}</Text>
      <Text style={styles.sheetNote}>{t.socDeleteAccountLocal}</Text>
      <Text style={styles.sheetLabel}>{fmt(t.socDeleteAccountType, { word })}</Text>
      <TextInput
        value={typed}
        onChangeText={setTyped}
        placeholder={word}
        placeholderTextColor={COLORS.inkMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        style={styles.sheetInput}
        editable={!busy}
      />
      {error ? <Text style={styles.sheetError}>{error}</Text> : null}
      <TouchableOpacity style={[styles.deleteBtn, (!ok || busy) && { opacity: 0.45 }]} disabled={!ok || busy} onPress={confirm}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteBtnText}>{t.socDeleteAccountConfirm}</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={busy}>
        <Text style={styles.cancelText}>{t.socCancel}</Text>
      </TouchableOpacity>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  identity: { alignItems: 'center', gap: 4 },
  name: { fontFamily: FONTS.black, fontSize: 20, color: COLORS.ink, marginTop: 8 },
  bio: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 },
  email: { fontFamily: FONTS.uiSemiBold, fontSize: 13, color: COLORS.inkSoft },
  since: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkMuted },
  editChip: { marginTop: 8, backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.pill, paddingVertical: 6, paddingHorizontal: 14 },
  editChipText: { fontFamily: FONTS.uiBold, fontSize: 12, color: COLORS.primary },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 16, alignItems: 'center', ...SHADOW },
  statValue: { fontFamily: FONTS.black, fontSize: 24, color: COLORS.primary },
  statLabel: { fontFamily: FONTS.uiSemiBold, fontSize: 11, color: COLORS.inkSoft, marginTop: 2 },
  section: { fontFamily: FONTS.extraBold, fontSize: 12, color: COLORS.inkSoft, textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 8 },
  group: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW },
  logoutBtn: {
    marginTop: 24, backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.hair,
  },
  logoutBtnText: { fontFamily: FONTS.extraBold, fontSize: 14, color: '#D93B4A' },
  sheetBody: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink, lineHeight: 21 },
  sheetNote: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, lineHeight: 17, marginTop: 8 },
  sheetLabel: { fontFamily: FONTS.uiBold, fontSize: 13, color: COLORS.ink, marginTop: 16 },
  sheetInput: {
    borderWidth: 1.5, borderColor: '#F3B7BE', borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 12, marginTop: 6,
    fontFamily: FONTS.uiBold, fontSize: 15, color: COLORS.ink, letterSpacing: 1,
  },
  sheetError: { fontFamily: FONTS.uiRegular, fontSize: 12, color: '#D93B4A', marginTop: 6 },
  deleteBtn: { backgroundColor: '#D93B4A', borderRadius: RADIUS.pill, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  deleteBtnText: { fontFamily: FONTS.extraBold, fontSize: 15, color: '#fff' },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontFamily: FONTS.uiSemiBold, fontSize: 14, color: COLORS.inkSoft },
});
