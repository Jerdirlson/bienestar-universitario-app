import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, G } from 'react-native-svg';
import RaizMark from '../components/RaizMark';
import UpbWordmark from '../components/UpbWordmark';
import { useApp } from '../context/AppContext';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';

function GoogleIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 20 20">
      <Path fill="#4285F4" d="M19.6 10.2c0-.7-.1-1.4-.2-2H10v3.8h5.4c-.2 1.3-1 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
      <Path fill="#34A853" d="M10 20c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H1.1v2.6C2.8 17.9 6.1 20 10 20z" />
      <Path fill="#FBBC05" d="M4.4 12c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V5.4H1.1C.4 6.8 0 8.3 0 10s.4 3.2 1.1 4.6L4.4 12z" />
      <Path fill="#EA4335" d="M10 4c1.5 0 2.8.5 3.8 1.5l2.8-2.8C15 1 12.7 0 10 0 6.1 0 2.8 2.1 1.1 5.4L4.4 8C5.2 5.8 7.4 4 10 4z" />
    </Svg>
  );
}

function AppleIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 20 20" fill="#000">
      <Path d="M14.8 10.6c0-2.4 2-3.6 2.1-3.6-1.1-1.6-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.5 1.2 0 1.7-.8 3.2-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.6-1-2.6-4.1zm-2.5-7.5c.7-.8 1.1-2 1-3.1-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.8-1.4z" />
    </Svg>
  );
}

export default function LoginScreen({ navigation }) {
  const { lang, t } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.topRow, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }} />
        <UpbWordmark size={20} />
      </View>

      <View style={styles.logoSection}>
        <RaizMark size={90} />
        <Text style={styles.appName}>Raíz</Text>
        <Text style={styles.sub}>{t.signInSub}</Text>
      </View>

      <View style={styles.form}>
        {/* SSO UPB */}
        <TouchableOpacity onPress={() => navigation.replace('Main')} activeOpacity={0.85}>
          <LinearGradient
            colors={['#FF003D', '#AD3DFF']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.upbBtn}
          >
            <View style={styles.upbIconWrap}>
              <UpbWordmark size={16} inverted />
            </View>
            <View style={styles.upbTextWrap}>
              <Text style={styles.upbBtnTitle}>{t.continueWithUpb}</Text>
              <Text style={styles.upbBtnSub}>correo@upb.edu.co</Text>
            </View>
            <Svg width="18" height="18" viewBox="0 0 18 18">
              <Path d="M6 3l6 6-6 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </LinearGradient>
        </TouchableOpacity>

        {/* Google */}
        <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}>
          <GoogleIcon />
          <Text style={styles.socialBtnText}>{t.continueWithGoogle}</Text>
        </TouchableOpacity>

        {/* Apple */}
        <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}>
          <AppleIcon />
          <Text style={styles.socialBtnText}>{t.continueWithApple}</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t.orEmail}</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          placeholder={lang === 'es' ? 'correo@upb.edu.co' : 'email@upb.edu.co'}
          placeholderTextColor={COLORS.inkMuted}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.magicBtn} activeOpacity={0.7}>
          <Text style={styles.magicBtnText}>{t.sendMagicLink}</Text>
        </TouchableOpacity>

        {/* Privacy */}
        <View style={styles.privacyBox}>
          <View style={styles.privacyIcon}>
            <Svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <Path d="M7 1L2 3v4c0 3 2.5 5 5 6 2.5-1 5-3 5-6V3L7 1z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={styles.privacyText}>{t.privacyNote}</Text>
        </View>
      </View>

      <Text style={styles.termsText}>
        {t.termsText}
        <Text style={styles.termsLink}>{t.terms}</Text>
        {t.andThe}
        <Text style={styles.termsLink}>{t.privacy}</Text>
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingBottom: 8,
  },
  logoSection: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  appName: { fontFamily: 'Nunito_900Black', fontSize: 30, color: COLORS.ink, marginTop: 6 },
  sub: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft, textAlign: 'center' },
  form: { paddingHorizontal: 20, gap: 10 },
  upbBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, padding: 16,
    shadowColor: '#AD3DFF', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 24, elevation: 8,
  },
  upbIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  upbTextWrap: { flex: 1 },
  upbBtnTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: '#fff' },
  upbBtnSub: { fontFamily: FONTS.uiRegular, fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: 'rgba(26,21,35,0.12)',
    borderRadius: 16, padding: 14,
  },
  socialBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.ink },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EEEBF5' },
  dividerText: { fontFamily: FONTS.uiSemiBold, fontSize: 11, color: COLORS.inkMuted },
  input: {
    borderWidth: 1, borderColor: 'rgba(26,21,35,0.12)',
    borderRadius: 14, padding: 14,
    fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink,
  },
  magicBtn: {
    backgroundColor: '#F2EFFA', borderRadius: 14, padding: 14,
    alignItems: 'center',
  },
  magicBtnText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.ink },
  privacyBox: {
    backgroundColor: COLORS.primarySoft, borderRadius: 14, padding: 14,
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 4,
  },
  privacyIcon: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  privacyText: { fontFamily: FONTS.uiRegular, fontSize: 11.5, color: COLORS.ink, lineHeight: 17, flex: 1 },
  termsText: {
    fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted,
    lineHeight: 16, textAlign: 'center', paddingHorizontal: 24, paddingTop: 16,
  },
  termsLink: { color: COLORS.primary, fontFamily: FONTS.uiBold },
});
