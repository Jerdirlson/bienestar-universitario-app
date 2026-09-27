import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Icon from '../../ui/Icon';
import { COLORS } from '../../theme';
import { avatarTone } from './format';

// Iniciales en negrita del peso correcto por plataforma (mismo motivo que
// theme.js: en Android/web una fuente personalizada por peso, en iOS
// `fontWeight` sobre la fuente del sistema). El tamaño es proporcional al
// avatar (no hay un token de tamaño único para esto), así que no puede salir
// de la escala fija de TYPE.
const boldWeight = Platform.OS === 'ios' ? { fontWeight: '700' } : { fontFamily: 'Inter_700Bold' };

/**
 * Avatar de la comunidad: emoji sobre un color de la paleta. Sin autor
 * (anónimo) muestra una silueta neutra, igual para todos, que no dice nada de
 * quién escribió. Con alias pero sin emoji (servidor v1) muestra iniciales.
 */
export default function Avatar({ author, size = 36, style }) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (!author) {
    return (
      <View style={[styles.base, dim, { backgroundColor: COLORS.fill }, style]}>
        <Icon name="person" size={size * 0.52} color={COLORS.tertiaryLabel} />
      </View>
    );
  }
  const tone = avatarTone(author.avatarColor);
  if (author.avatarEmoji) {
    return (
      <View style={[styles.base, dim, { backgroundColor: tone.bg }, style]}>
        <Text style={{ fontSize: size * 0.52, lineHeight: size * 0.68 }} allowFontScaling={false}>{author.avatarEmoji}</Text>
      </View>
    );
  }
  const initials = (author.displayName ?? '?').trim().slice(0, 2).toUpperCase();
  return (
    <View style={[styles.base, dim, { backgroundColor: tone.bg }, style]}>
      <Text style={[boldWeight, { fontSize: size * 0.36, color: tone.ink }]} allowFontScaling={false}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
