import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import TopBar from '../components/TopBar';
import { useApp } from '../context/AppContext';
import { updateDisplayName, AuthError } from '../data/session';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';

const initialsFromEmail = (email) => {
  const local = email?.split('@')[0] ?? '';
  return local.slice(0, 2).toUpperCase();
};

export default function ProfileScreen({ navigation }) {
  const { t, lang, userEmail, userName, memberSince, streak, entries, sessionToken, refreshProfile, logout } = useApp();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(userName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState(null);

  const startEditing = () => {
    setNameDraft(userName ?? '');
    setNameError(null);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    setNameError(null);
    setSavingName(true);
    try {
      await updateDisplayName(sessionToken, nameDraft.trim());
      await refreshProfile();
      setEditingName(false);
    } catch (e) {
      setNameError(e instanceof AuthError && e.code === 'nombre_invalido' ? 'nameLengthError' : 'genericAuthError');
    } finally {
      setSavingName(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const joinedLabel = memberSince
    ? new Date(memberSince).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <View style={styles.container}>
      <TopBar title={t.profileTitle} onBack={() => navigation.goBack()} right={<View style={{ width: 36 }} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarBig}>
          <Text style={styles.avatarBigText}>{initialsFromEmail(userEmail)}</Text>
        </View>

        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder={t.displayNamePlaceholder}
              placeholderTextColor={COLORS.inkMuted}
              style={styles.nameInput}
              editable={!savingName}
              autoFocus
              maxLength={40}
            />
            <TouchableOpacity onPress={handleSaveName} disabled={savingName} style={styles.saveNameBtn}>
              {savingName ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveNameBtnText}>{t.save}</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={startEditing}>
            <Text style={styles.name}>{userName ?? t.setDisplayName}</Text>
          </TouchableOpacity>
        )}
        {nameError && <Text style={styles.errorText}>{t[nameError]}</Text>}

        <Text style={styles.email}>{userEmail ?? t.noSession}</Text>
        {joinedLabel && <Text style={styles.memberSince}>{t.memberSince} {joinedLabel}</Text>}

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

        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.7} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>{t.logOut}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 8 },
  avatarBig: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    ...SHADOW,
  },
  avatarBigText: { fontFamily: FONTS.black, fontSize: 28, color: COLORS.primary },
  name: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.ink },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  nameInput: {
    flex: 1, borderWidth: 1, borderColor: 'rgba(26,21,35,0.12)',
    borderRadius: RADIUS.sm, padding: 10,
    fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink,
  },
  saveNameBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  saveNameBtnText: { fontFamily: FONTS.extraBold, fontSize: 13, color: '#fff' },
  email: { fontFamily: FONTS.uiSemiBold, fontSize: 14, color: COLORS.inkSoft },
  memberSince: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkMuted },
  errorText: { fontFamily: FONTS.uiRegular, fontSize: 12, color: '#D93B4A' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 24, alignSelf: 'stretch' },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 16,
    alignItems: 'center', ...SHADOW,
  },
  statValue: { fontFamily: FONTS.black, fontSize: 24, color: COLORS.primary },
  statLabel: { fontFamily: FONTS.uiSemiBold, fontSize: 11, color: COLORS.inkSoft, marginTop: 2 },
  logoutBtn: {
    marginTop: 28, alignSelf: 'stretch',
    backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.hair,
  },
  logoutBtnText: { fontFamily: FONTS.extraBold, fontSize: 14, color: '#D93B4A' },
});
