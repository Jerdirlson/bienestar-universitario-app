import React from 'react';
import { Modal, View, StyleSheet, Platform } from 'react-native';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import Icon from '../../ui/Icon';
import { useApp } from '../../context/AppContext';
import { COLORS, RADIUS, SPACING } from '../../theme';

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
                <Icon name="heart" size={28} color={COLORS.sos} />
              </View>
              <Text variant="title2" style={styles.title}>{t.socResultCrisisTitle}</Text>
              <Text variant="body" color={COLORS.secondaryLabel} style={styles.body}>{t.socResultCrisisBody}</Text>
              <Button variant="filled" onPress={onSos} style={styles.sosBtn}>{t.socResultCrisisSos}</Button>
              <Text variant="footnote" color={COLORS.tertiaryLabel} style={styles.note}>{t.socResultCrisisNote}</Text>
              <Button variant="plain" onPress={onClose}>{t.socResultCrisisLater}</Button>
            </>
          ) : (
            <>
              <View style={[styles.icon, { backgroundColor: COLORS.tones.sun.bg }]}>
                <Icon name="time-outline" size={26} color={COLORS.tones.sun.ink} />
              </View>
              <Text variant="title2" style={styles.title}>{kind === 'comment' ? t.socCommentReviewTitle : t.socResultReviewTitle}</Text>
              <Text variant="body" color={COLORS.secondaryLabel} style={styles.body}>{kind === 'comment' ? t.socCommentReviewBody : t.socResultReviewBody}</Text>
              <Button variant="filled" onPress={onClose} style={styles.primary}>{t.socUnderstood}</Button>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  card: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.xl, width: '100%', maxWidth: 420,
    alignItems: 'center', gap: SPACING.sm,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', lineHeight: 21 },
  note: { textAlign: 'center', lineHeight: 17 },
  sosBtn: { alignSelf: 'stretch', backgroundColor: COLORS.sos, marginTop: SPACING.xs },
  primary: { alignSelf: 'stretch', marginTop: SPACING.xs },
});
