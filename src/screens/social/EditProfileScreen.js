import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../../components/social/Header';
import KeyboardScreen from '../../components/KeyboardScreen';
import Avatar from '../../components/social/Avatar';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import { TextField, TextArea } from '../../ui/TextField';
import { AVATAR_EMOJIS, avatarTone, errorText, fmt } from '../../components/social/format';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import { updateProfile } from '../../data/session';
import { AVATAR_COLORS, LIMITS, validateProfileDraft, ApiError } from '../../data/socialCore';
import { COLORS, RADIUS, SPACING } from '../../theme';

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
      <Header title={t.socEditProfile} onBack={() => navigation.goBack()} />
      <KeyboardScreen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.previewWrap}>
            <Avatar author={preview} size={92} />
            <Text variant="headline">{name.trim() || t.socSetAlias}</Text>
          </View>

          <Text variant="headline" style={styles.label}>{t.socAlias}</Text>
          <TextField
            value={name}
            onChangeText={touch(setName)}
            placeholder={t.displayNamePlaceholder}
            maxLength={LIMITS.displayNameMax}
            autoCapitalize="words"
            editable={!saving}
          />
          <Text variant="footnote" color={COLORS.secondaryLabel} style={styles.hint}>{t.socAliasFieldHint}</Text>

          {isV1 ? (
            <Text variant="footnote" color={COLORS.secondaryLabel} style={styles.note}>{t.socV1ProfileNote}</Text>
          ) : (
            <>
              <Text variant="headline" style={styles.label}>{t.socBio}</Text>
              <TextArea
                value={bio}
                onChangeText={touch(setBio)}
                placeholder={t.socBioPlaceholder}
                minHeight={80}
                maxLength={LIMITS.bio}
                editable={!saving}
              />
              <Text variant="caption1" color={COLORS.tertiaryLabel} style={styles.counter}>{fmt(t.socCharCount, { n: bio.length, max: LIMITS.bio })}</Text>

              <Text variant="headline" style={styles.label}>{t.socAvatar}</Text>
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

              <Text variant="headline" style={styles.label}>{t.socAvatarColorLabel}</Text>
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

          {error ? <Text variant="footnote" color={COLORS.destructive} style={styles.error}>{error}</Text> : null}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
          <Button variant="filled" disabled={!changed || saving} loading={saving} onPress={save}>{t.socSave}</Button>
        </View>
      </KeyboardScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.xl, gap: SPACING.sm, paddingBottom: SPACING.xl },
  previewWrap: { alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  label: { marginTop: SPACING.md },
  hint: { lineHeight: 17 },
  note: {
    lineHeight: 17, backgroundColor: COLORS.accentTint, padding: SPACING.md, borderRadius: RADIUS.sm, marginTop: SPACING.md,
  },
  counter: { alignSelf: 'flex-end' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  emojiCell: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  emojiActive: { borderColor: COLORS.accent },
  emoji: { fontSize: 22 },
  colors: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'transparent' },
  error: { textAlign: 'center', marginTop: SPACING.sm },
  footer: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.separator, backgroundColor: COLORS.bg },
});
