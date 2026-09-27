import React from 'react';
import { Modal, View, TouchableOpacity, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardScreen from '../KeyboardScreen';
import Text from '../../ui/Text';
import { COLORS, RADIUS, SPACING } from '../../theme';

/**
 * Hoja inferior propia. Existe porque Alert.alert con más de 3 botones no
 * funciona bien en Android: los menús y los motivos de reporte viven aquí.
 * Varias hojas (reportar, borrar cuenta) tienen su propio TextInput, así que
 * también necesitan compensar el teclado en Android (ver KeyboardScreen).
 */
export default function Sheet({ visible, onClose, title, subtitle, children }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardScreen style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <View style={styles.handle} />
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.inner}>
            {title ? <Text variant="title3" style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text variant="subhead" color={COLORS.secondaryLabel} style={styles.subtitle}>{subtitle}</Text> : null}
            {children}
          </ScrollView>
        </View>
      </KeyboardScreen>
    </Modal>
  );
}

/**
 * Menú de opciones: [{ key, label, onPress, destructive }]. Estilo hoja de
 * acciones de iOS: las opciones en una tarjeta, "Cancelar" en una tarjeta
 * aparte debajo (mismo espaciado que un action sheet nativo).
 */
export function OptionSheet({ visible, onClose, title, options = [], cancelLabel }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.card}>
        {options.map((o, i) => (
          <TouchableOpacity
            key={o.key}
            style={[styles.option, i === options.length - 1 && styles.optionLast]}
            activeOpacity={0.6}
            onPress={() => { onClose(); setTimeout(o.onPress, 250); }}
          >
            <Text variant="body" color={o.destructive ? COLORS.destructive : COLORS.accent} style={styles.optionText}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {cancelLabel ? (
        <View style={[styles.card, styles.cancelCard]}>
          <TouchableOpacity style={[styles.option, styles.optionLast]} onPress={onClose} activeOpacity={0.6}>
            <Text variant="headline" color={COLORS.accent} style={styles.optionText}>{cancelLabel}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: COLORS.bgElevated, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACING.sm, maxHeight: '88%',
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.separator, marginBottom: SPACING.sm },
  inner: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xs, gap: SPACING.xs },
  title: { marginBottom: 2 },
  subtitle: { marginBottom: SPACING.sm, lineHeight: 19 },
  card: {
    backgroundColor: COLORS.fill, borderRadius: RADIUS.md, overflow: 'hidden',
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  cancelCard: { marginTop: SPACING.sm },
  option: {
    paddingVertical: SPACING.md, alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.separator,
  },
  optionLast: { borderBottomWidth: 0 },
  optionText: { textAlign: 'center' },
});
