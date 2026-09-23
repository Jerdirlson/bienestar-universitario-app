import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../../theme';

export default function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: FONTS.extraBold, fontSize: 22, color: COLORS.ink, flexShrink: 1 },
  action: { fontFamily: FONTS.uiSemiBold, fontSize: 13, color: COLORS.primary },
});
