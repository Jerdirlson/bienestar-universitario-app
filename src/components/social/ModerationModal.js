import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useApp } from '../../context/AppContext';
import { COLORS, FONTS, RADIUS } from '../../theme';

/**
 * Resultado de moderación cuando algo NO se publicó en el acto.
 *
 * - review: explica que un moderador lo leerá pronto.
 * - crisis: mensaje empático y el acceso a la pantalla Sos como acción
 *   principal. Es lo más importante de todo el flujo de publicar: el botón
 *   siempre llama a onSos, sin depender de la red.
 */
export default function ModerationModal({ result, kind = 'post', onClose, onSos }) {
  const { t } = useApp();
  const visible = !!result && result.outcome === 'held';
  const crisis = result?.reason === 'crisis';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          {crisis ? (
            <>
              <View style={[styles.icon, { backgroundColor: COLORS.tones.rose.bg }]}>
                <Svg width="26" height="26" viewBox="0 0 16 16">
                  <Path d="M8 14s-5-3-5-7a3 3 0 015-2 3 3 0 015 2c0 4-5 7-5 7z" fill="#F37171" />
                </Svg>
              </View>
              <Text style={styles.title}>{t.socResultCrisisTitle}</Text>
              <Text style={styles.body}>{t.socResultCrisisBody}</Text>
              <TouchableOpacity
                style={styles.sosBtn}
                onPress={onSos}
                accessibilityRole="button"
                activeOpacity={0.85}
              >
                <Text style={styles.sosBtnText}>{t.socResultCrisisSos}</Text>
              </TouchableOpacity>
              <Text style={styles.note}>{t.socResultCrisisNote}</Text>
              <TouchableOpacity style={styles.secondary} onPress={onClose} accessibilityRole="button">
                <Text style={styles.secondaryText}>{t.socResultCrisisLater}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.icon, { backgroundColor: COLORS.tones.sun.bg }]}>
                <Svg width="24" height="24" viewBox="0 0 16 16">
                  <Path d="M8 1.5a6.5 6.5 0 110 13 6.5 6.5 0 010-13zM8 4.5V8l2.5 1.5" stroke={COLORS.tones.sun.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </Svg>
              </View>
              <Text style={styles.title}>{kind === 'comment' ? t.socCommentReviewTitle : t.socResultReviewTitle}</Text>
              <Text style={styles.body}>{kind === 'comment' ? t.socCommentReviewBody : t.socResultReviewBody}</Text>
              <TouchableOpacity style={styles.primary} onPress={onClose} accessibilityRole="button">
                <Text style={styles.primaryText}>{t.socUnderstood}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26,21,35,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 24, width: '100%', maxWidth: 420, alignItems: 'center', gap: 10 },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontFamily: FONTS.black, fontSize: 20, color: COLORS.ink, textAlign: 'center' },
  body: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.inkSoft, lineHeight: 21, textAlign: 'center' },
  note: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkMuted, textAlign: 'center', lineHeight: 17 },
  sosBtn: {
    alignSelf: 'stretch', backgroundColor: '#F37171', borderRadius: RADIUS.pill, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
    shadowColor: '#F37171', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
  },
  sosBtnText: { fontFamily: FONTS.extraBold, fontSize: 16, color: '#fff' },
  primary: { alignSelf: 'stretch', backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  primaryText: { fontFamily: FONTS.extraBold, fontSize: 15, color: '#fff' },
  secondary: { paddingVertical: 10, paddingHorizontal: 16 },
  secondaryText: { fontFamily: FONTS.uiSemiBold, fontSize: 14, color: COLORS.inkSoft },
});
