import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS } from '../../theme';

/**
 * Hoja inferior propia. Existe porque Alert.alert con más de 3 botones no
 * funciona bien en Android: los menús y los motivos de reporte viven aquí.
 */
export default function Sheet({ visible, onClose, title, subtitle, children }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.inner}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Menú de opciones: [{ key, label, onPress, destructive }]. */
export function OptionSheet({ visible, onClose, title, options = [], cancelLabel }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {options.map(o => (
        <TouchableOpacity
          key={o.key}
          style={styles.option}
          activeOpacity={0.7}
          onPress={() => { onClose(); setTimeout(o.onPress, 250); }}
        >
          <Text style={[styles.optionText, o.destructive && styles.destructive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
      {cancelLabel ? (
        <TouchableOpacity style={[styles.option, styles.cancel]} onPress={onClose} activeOpacity={0.7}>
          <Text style={[styles.optionText, styles.cancelText]}>{cancelLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,21,35,0.35)' },
  sheet: {
    backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingTop: 8, maxHeight: '88%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.hair, marginBottom: 8 },
  inner: { paddingHorizontal: 20, paddingBottom: 4, gap: 4 },
  title: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.ink, marginBottom: 2 },
  subtitle: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft, lineHeight: 19, marginBottom: 8 },
  option: { paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.hair },
  optionText: { fontFamily: FONTS.uiSemiBold, fontSize: 15, color: COLORS.ink },
  destructive: { color: '#D93B4A' },
  cancel: { borderBottomWidth: 0, alignItems: 'center', marginTop: 4 },
  cancelText: { color: COLORS.inkSoft },
});
