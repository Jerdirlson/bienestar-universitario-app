import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import { useApp } from '../../context/AppContext';
import { COLORS, FONTS, RADIUS } from '../../theme';

/**
 * Elegir entre anónimo (por defecto) o con mi alias. Sin alias, la opción con
 * nombre invita a elegir uno en vez de quedar simplemente deshabilitada.
 */
export default function IdentityPicker({ anonymous, onChange, alias, avatar, onSetAlias, compact = false }) {
  const { t } = useApp();
  const named = alias ? { displayName: alias, avatarEmoji: avatar?.avatarEmoji, avatarColor: avatar?.avatarColor } : null;

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.option, compact && styles.optionCompact, anonymous && styles.active]}
          onPress={() => onChange(true)}
          accessibilityRole="radio"
          accessibilityState={{ selected: anonymous }}
        >
          <Avatar author={null} size={compact ? 22 : 30} />
          <Text style={[styles.text, anonymous && styles.textActive]} numberOfLines={1}>{t.socAnonymous}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.option, compact && styles.optionCompact, !anonymous && styles.active, !alias && styles.dashed]}
          onPress={() => (alias ? onChange(false) : onSetAlias?.())}
          accessibilityRole="radio"
          accessibilityState={{ selected: !anonymous, disabled: !alias }}
        >
          {named ? <Avatar author={named} size={compact ? 22 : 30} /> : null}
          <Text style={[styles.text, !anonymous && styles.textActive, !alias && styles.textMuted]} numberOfLines={1}>
            {alias ?? t.socAliasMissing}
          </Text>
        </TouchableOpacity>
      </View>
      {!compact ? (
        !alias ? (
          <View style={styles.hintBox}>
            <Text style={styles.hint}>{t.socAliasHint}</Text>
            <TouchableOpacity onPress={onSetAlias}>
              <Text style={styles.link}>{t.socSetAliasCta}</Text>
            </TouchableOpacity>
          </View>
        ) : anonymous ? (
          <Text style={styles.hint}>{t.socAnonHint}</Text>
        ) : null
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: 'rgba(26,21,35,0.10)', backgroundColor: COLORS.bgCard,
  },
  optionCompact: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.pill },
  active: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  dashed: { borderStyle: 'dashed' },
  text: { flex: 1, fontFamily: FONTS.uiSemiBold, fontSize: 13, color: COLORS.inkSoft },
  textActive: { color: COLORS.primaryDeep },
  textMuted: { color: COLORS.inkMuted },
  hintBox: { gap: 4 },
  hint: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, lineHeight: 17 },
  link: { fontFamily: FONTS.uiBold, fontSize: 12, color: COLORS.primary },
});
