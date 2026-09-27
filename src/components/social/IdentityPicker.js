import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Avatar from './Avatar';
import Text from '../../ui/Text';
import { useApp } from '../../context/AppContext';
import { COLORS, RADIUS, SPACING } from '../../theme';

/**
 * Elegir entre anónimo (por defecto) o con mi alias. Sin alias, la opción con
 * nombre invita a elegir uno en vez de quedar simplemente deshabilitada.
 */
export default function IdentityPicker({ anonymous, onChange, alias, avatar, onSetAlias, compact = false }) {
  const { t } = useApp();
  const named = alias ? { displayName: alias, avatarEmoji: avatar?.avatarEmoji, avatarColor: avatar?.avatarColor } : null;

  return (
    <View style={{ gap: SPACING.sm }}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.option, compact && styles.optionCompact, anonymous && styles.active]}
          onPress={() => onChange(true)}
          accessibilityRole="radio"
          accessibilityState={{ selected: anonymous }}
        >
          <Avatar author={null} size={compact ? 22 : 30} />
          <Text variant="subhead" color={anonymous ? COLORS.accent : COLORS.secondaryLabel} numberOfLines={1} style={styles.text}>{t.socAnonymous}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.option, compact && styles.optionCompact, !anonymous && styles.active, !alias && styles.dashed]}
          onPress={() => (alias ? onChange(false) : onSetAlias?.())}
          accessibilityRole="radio"
          accessibilityState={{ selected: !anonymous, disabled: !alias }}
        >
          {named ? <Avatar author={named} size={compact ? 22 : 30} /> : null}
          <Text
            variant="subhead"
            color={!anonymous ? COLORS.accent : (!alias ? COLORS.tertiaryLabel : COLORS.secondaryLabel)}
            numberOfLines={1}
            style={styles.text}
          >
            {alias ?? t.socAliasMissing}
          </Text>
        </TouchableOpacity>
      </View>
      {!compact ? (
        !alias ? (
          <View style={styles.hintBox}>
            <Text variant="footnote" color={COLORS.secondaryLabel}>{t.socAliasHint}</Text>
            <TouchableOpacity onPress={onSetAlias}>
              <Text variant="footnote" color={COLORS.accent}>{t.socSetAliasCta}</Text>
            </TouchableOpacity>
          </View>
        ) : anonymous ? (
          <Text variant="footnote" color={COLORS.secondaryLabel}>{t.socAnonHint}</Text>
        ) : null
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACING.sm },
  option: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.separator, backgroundColor: COLORS.bgElevated,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  optionCompact: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.pill },
  active: { borderColor: COLORS.accent, backgroundColor: COLORS.accentTint },
  dashed: { borderStyle: 'dashed' },
  text: { flex: 1 },
  hintBox: { gap: SPACING.xs / 2 },
});
