import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import RaizMark from '../components/RaizMark';
import UpbWordmark from '../components/UpbWordmark';
import KeyboardScreen from '../components/KeyboardScreen';
import { useApp } from '../context/AppContext';
import { COLORS, FONTS } from '../theme';
import { loginWithPassword, AuthError } from '../data/session';

// credenciales_invalidas/demasiados_intentos son los que el API puede
// devolver de forma esperada (ver api/src/auth.js); cualquier otra cosa (sin
// red, sin EXPO_PUBLIC_API_URL, 500) cae en el mensaje genérico.
function authErrorKey(error) {
  if (error instanceof AuthError) {
    if (error.code === 'credenciales_invalidas') return 'invalidCodeError';
    if (error.code === 'demasiados_intentos') return 'tooManyAttemptsError';
  }
  return 'genericAuthError';
}

// SSO institucional, Google, Apple y el login por código quedan
// deshabilitados por ahora — ver src/data/session.js para el código de
// código de correo, que sigue ahí y probado, solo no expuesto en esta
// pantalla mientras se prueba con correo y contraseña.
export default function LoginScreen({ navigation, route }) {
  const { t, completeLogin } = useApp();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setError(null);
    setBusy(true);
    try {
      const token = await loginWithPassword(email.trim().toLowerCase(), password);
      completeLogin(token);
      navigation.replace('Main');
    } catch (e) {
      setError(authErrorKey(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    // Sin esto, en Android con edge-to-edge el teclado tapaba el campo de
    // contraseña y el botón "Iniciar sesión" (ver KeyboardScreen).
    <KeyboardScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
          <TextInput
            testID="login-email"
            value={email}
            onChangeText={setEmail}
            placeholder={t.emailPlaceholderCode}
            placeholderTextColor={COLORS.inkMuted}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!busy}
          />
          <TextInput
            testID="login-password"
            value={password}
            onChangeText={setPassword}
            placeholder={t.passwordPlaceholder}
            placeholderTextColor={COLORS.inkMuted}
            style={styles.input}
            secureTextEntry
            editable={!busy}
          />
          {error ? <Text style={styles.errorText}>{t[error]}</Text> : null}
          {/* Llegó aquí porque el servidor rechazó la sesión guardada. */}
          {!error && route?.params?.expired ? <Text style={styles.errorText}>{t.socErrSession}</Text> : null}
          <TouchableOpacity
            style={[styles.magicBtn, busy && styles.btnDisabled]}
            activeOpacity={0.7}
            disabled={busy || !email.trim() || !password}
            onPress={handleLogin}
          >
            {busy ? (
              <ActivityIndicator color={COLORS.ink} />
            ) : (
              <Text style={styles.magicBtnText}>{t.logIn}</Text>
            )}
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
    </KeyboardScreen>
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
  btnDisabled: { opacity: 0.6 },
  errorText: {
    fontFamily: FONTS.uiRegular, fontSize: 12.5, color: '#D93B4A',
    paddingHorizontal: 2,
  },
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
