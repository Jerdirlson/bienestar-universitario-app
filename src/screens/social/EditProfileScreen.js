import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../../components/TopBar';
import Avatar from '../../components/social/Avatar';
import { AVATAR_EMOJIS, avatarTone, errorText, fmt } from '../../components/social/format';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import { updateProfile } from '../../data/session';
import { AVATAR_COLORS, LIMITS, validateProfileDraft, ApiError } from '../../data/socialCore';
import { COLORS, FONTS, RADIUS } from '../../theme';

/**
 * Editar alias, descripción y avatar (emoji + color de la paleta del
 * contrato). Solo se envía lo que cambió. Con servidor v1 solo el alias.
 */
export default function EditProfileScreen({ navigation }) {
  const { t, sessionToken } = useApp();
  const { isV1, me, refreshMe, showToast } = useSocial();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(me?.displayName ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [emoji, setEmoji] = useState(me?.avatarEmoji ?? AVATAR_EMOJIS[0]);
  const [color, setColor] = useState(me?.avatarColor ?? 'lilac');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Si el perfil llega después de abrir la pantalla, se rellena mientras no
  // se haya tocado nada.
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current || !me) return;
    setName(me.displayName ?? '');
    setBio(me.bio ?? '');
    setEmoji(me.avatarEmoji ?? AVATAR_EMOJIS[0]);
    setColor(me.avatarColor ?? 'lilac');
  }, [me]);
  const touch = (fn) => (v) => { touched.current = true; fn(v); };

  const patch = {};
  if (name.trim() !== (me?.displayName ?? '')) patch.displayName = name.trim();
  if (!isV1) {
    if (bio.trim() !== (me?.bio ?? '')) patch.bio = bio.trim();
    if (emoji !== me?.avatarEmoji) patch.avatarEmoji = emoji;
    if (color !== me?.avatarColor) patch.avatarColor = color;
  }
  const changed = Object.keys(patch).length > 0;

  const save = async () => {
    if (!changed || saving) return;
    const invalid = validateProfileDraft(patch);
    if (invalid) { setError(errorText(new ApiError(invalid), t)); return; }
    setSaving(true);
    setError(null);
    try {
      await updateProfile(sessionToken, patch);
      await refreshMe();
      showToast(t.socProfileSaved);
      navigation.goBack();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setSaving(false);
    }
  };

  const preview = { displayName: name.trim() || '?', avatarEmoji: isV1 ? null : emoji, avatarColor: color };

  return (
    <View style={styles.container}>
      <TopBar title={t.socEditProfile} onBack={() => navigation.goBack()} right={<View style={{ width: 36 }} />} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.previewWrap}>
            <Avatar author={preview} size={92} />
            <Text style={styles.previewName}>{name.trim() || t.socSetAlias}</Text>
          </View>

          <Text style={styles.label}>{t.socAlias}</Text>
          <TextInput
            value={name}
            onChangeText={touch(setName)}
            placeholder={t.displayNamePlaceholder}
            placeholderTextColor={COLORS.inkMuted}
            style={styles.input}
            maxLength={LIMITS.displayNameMax}
            autoCapitalize="words"
            editable={!saving}
          />
          <Text style={styles.hint}>{t.socAliasFieldHint}</Text>

          {isV1 ? (
            <Text style={styles.note}>{t.socV1ProfileNote}</Text>
          ) : (
            <>
              <Text style={styles.label}>{t.socBio}</Text>
              <TextInput
                value={bio}
                onChangeText={touch(setBio)}
                placeholder={t.socBioPlaceholder}
                placeholderTextColor={COLORS.inkMuted}
                style={[styles.input, styles.bio]}
                maxLength={LIMITS.bio}
                multiline
                editable={!saving}
              />
              <Text style={styles.counter}>{fmt(t.socCharCount, { n: bio.length, max: LIMITS.bio })}</Text>

              <Text style={styles.label}>{t.socAvatar}</Text>
              <View style={styles.emojiGrid}>
                {AVATAR_EMOJIS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.emojiCell, { backgroundColor: avatarTone(color).bg }, emoji === e && styles.emojiActive]}
                    onPress={() => touch(setEmoji)(e)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: emoji === e }}
                  >
                    <Text style={styles.emoji} allowFontScaling={false}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t.socAvatarColorLabel}</Text>
              <View style={styles.colors}>
                {AVATAR_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.swatch, { backgroundColor: avatarTone(c).bg }, color === c && { borderColor: avatarTone(c).ink }]}
                    onPress={() => touch(setColor)(c)}
                    accessibilityRole="radio"
                    accessibilityLabel={t.socAvatarColors[c]}
                    accessibilityState={{ selected: color === c }}
                  />
                ))}
              </View>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={[styles.saveBtn, (!changed || saving) && styles.disabled]} disabled={!changed || saving} onPress={save}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{t.socSave}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, gap: 8, paddingBottom: 24 },
  previewWrap: { alignItems: 'center', gap: 8, marginBottom: 8 },
  previewName: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.ink },
  label: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.ink, marginTop: 12 },
  input: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: 'rgba(26,21,35,0.12)', borderRadius: RADIUS.sm,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: FONTS.uiRegular, fontSize: 15, color: COLORS.ink,
  },
  bio: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, lineHeight: 17 },
  note: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, lineHeight: 17, backgroundColor: COLORS.primarySoft, padding: 12, borderRadius: RADIUS.sm, marginTop: 12 },
  counter: { alignSelf: 'flex-end', fontFamily: FONTS.uiMedium, fontSize: 11, color: COLORS.inkMuted },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiCell: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  emojiActive: { borderColor: COLORS.primary },
  emoji: { fontSize: 22 },
  colors: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'transparent' },
  error: { fontFamily: FONTS.uiSemiBold, fontSize: 13, color: '#D93B4A', textAlign: 'center', marginTop: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.hair, backgroundColor: COLORS.bg },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center' },
  saveText: { fontFamily: FONTS.extraBold, fontSize: 16, color: '#fff' },
  disabled: { opacity: 0.5 },
});
