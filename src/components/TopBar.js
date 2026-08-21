import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS, FONTS, SHADOW } from '../theme';
import { useApp } from '../context/AppContext';

const initialsFromEmail = (email) => {
  const local = email?.split('@')[0] ?? '';
  return local.slice(0, 2).toUpperCase();
};

export default function TopBar({ title, onBack, onClose, right }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { userEmail } = useApp();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 12 }]}>
      <View style={styles.side}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
            <Svg width="10" height="18" viewBox="0 0 10 18">
              <Path d="M9 1L1 9l8 8" stroke={COLORS.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.side, styles.rightSide]}>
        {onClose ? (
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <Svg width="16" height="16" viewBox="0 0 16 16">
              <Path d="M2 2l12 12M14 2L2 14" stroke={COLORS.ink} strokeWidth="2.5" strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        ) : right ? right : (
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            {userEmail ? (
              <Text style={styles.avatarInitials}>{initialsFromEmail(userEmail)}</Text>
            ) : (
              <Svg width="16" height="16" viewBox="0 0 16 16">
                <Circle cx="8" cy="5.5" r="3" fill="none" stroke={COLORS.ink} strokeWidth="1.8" />
                <Path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" fill="none" stroke={COLORS.ink} strokeWidth="1.8" strokeLinecap="round" />
              </Svg>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  side: { width: 40 },
  rightSide: { alignItems: 'flex-end' },
  title: {
    fontFamily: FONTS.extraBold, fontSize: 13,
    color: COLORS.ink, textTransform: 'uppercase', letterSpacing: 1.5,
  },
  iconBtn: { padding: 6 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW,
  },
  avatarInitials: { fontFamily: FONTS.extraBold, fontSize: 12, color: COLORS.primary },
});
