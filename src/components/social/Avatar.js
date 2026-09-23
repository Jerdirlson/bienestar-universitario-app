import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { COLORS, FONTS } from '../../theme';
import { avatarTone } from './format';

/**
 * Avatar de la comunidad: emoji sobre un color de la paleta. Sin autor
 * (anónimo) muestra una silueta neutra, igual para todos, que no dice nada de
 * quién escribió. Con alias pero sin emoji (servidor v1) muestra iniciales.
 */
export default function Avatar({ author, size = 36, style }) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (!author) {
    return (
      <View style={[styles.base, dim, { backgroundColor: '#EFEDF4' }, style]}>
        <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16">
          <Circle cx="8" cy="5.5" r="3" fill="none" stroke={COLORS.inkMuted} strokeWidth="1.6" />
          <Path d="M2.5 14c0-3 2.4-5 5.5-5s5.5 2 5.5 5" fill="none" stroke={COLORS.inkMuted} strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
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
      <Text style={[styles.initials, { fontSize: size * 0.36, color: tone.ink }]} allowFontScaling={false}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontFamily: FONTS.black },
});
