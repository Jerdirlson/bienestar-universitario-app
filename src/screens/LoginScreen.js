import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import RaizMark from '../components/RaizMark';
import UpbWordmark from '../components/UpbWordmark';
import { Screen, Text, TextField, Button, Icon } from '../ui';
import { useApp } from '../context/AppContext';
import { COLORS, SPACING, RADIUS } from '../theme';
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
    // `Screen` con `keyboard` (§8, regla dura): correo, contraseña y "Entrar"
    // quedan siempre visibles sobre el teclado, en iOS y Android.
    <Screen variant="plain" keyboard>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <UpbWordmark size={18} />
        </View>

        <View style={styles.logoSection}>
          <RaizMark size={84} />
          <Text variant="title1" style={styles.appName}>Raíz</Text>
          <Text variant="subhead" color={COLORS.secondaryLabel} style={styles.sub}>{t.signInSub}</Text>
        </View>

        <View style={styles.form}>
          <TextField
            testID="login-email"
            value={email}
            onChangeText={setEmail}
            placeholder={t.emailPlaceholderCode}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
          <TextField
            testID="login-password"
            value={password}
            onChangeText={setPassword}
            placeholder={t.passwordPlaceholder}
            secureTextEntry
            editable={!busy}
          />

          {error ? (
            <Text variant="footnote" color={COLORS.destructive} style={styles.errorText}>{t[error]}</Text>
          ) : null}
          {/* Llegó aquí porque el servidor rechazó la sesión guardada. */}
          {!error && route?.params?.expired ? (
            <Text variant="footnote" color={COLORS.destructive} style={styles.errorText}>{t.socErrSession}</Text>
          ) : null}

          <Button
            onPress={handleLogin}
            disabled={busy || !email.trim() || !password}
            loading={busy}
            style={styles.submit}
          >
            {t.logIn}
          </Button>

          {/* H15 de la auditoría: una línea honesta para quien llega sin
              cuenta o sin clave, sin inventar un correo o teléfono de soporte
              que hoy no existe (ver t.loginHelp en src/i18n.js). */}
          <Text variant="caption1" color={COLORS.tertiaryLabel} style={styles.helpText}>
            {t.loginHelp}
          </Text>

          <View style={styles.privacyBox}>
            <View style={styles.privacyIcon}>
              <Icon name="shield-checkmark" size={16} color="#fff" />
            </View>
            <Text variant="footnote" color={COLORS.label} style={styles.privacyText}>{t.privacyNote}</Text>
          </View>
        </View>

        <Text variant="caption1" color={COLORS.tertiaryLabel} style={styles.termsText}>
          {t.termsText}
          <Text variant="caption1" color={COLORS.accent} style={styles.termsLink}>{t.terms}</Text>
          {t.andThe}
          <Text variant="caption1" color={COLORS.accent} style={styles.termsLink}>{t.privacy}</Text>
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: SPACING.xxl },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  logoSection: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.xs },
  appName: { color: COLORS.label, marginTop: SPACING.xs },
  sub: { textAlign: 'center' },
  form: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  errorText: { paddingHorizontal: SPACING.xs },
  submit: { marginTop: SPACING.xs },
  helpText: { textAlign: 'center', marginTop: SPACING.xs },
  privacyBox: {
    backgroundColor: COLORS.accentTint, borderRadius: RADIUS.lg, padding: SPACING.md,
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start', marginTop: SPACING.sm,
  },
  privacyIcon: {
    width: 28, height: 28, borderRadius: RADIUS.sm, backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  privacyText: { flex: 1, lineHeight: 18 },
  termsText: { textAlign: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, lineHeight: 16 },
  termsLink: { textDecorationLine: 'underline' },
});
