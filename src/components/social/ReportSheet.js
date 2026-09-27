import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Sheet from './Sheet';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import { TextArea } from '../../ui/TextField';
import { useApp } from '../../context/AppContext';
import { REPORT_REASONS, LIMITS } from '../../data/socialCore';
import { COLORS, RADIUS, SPACING } from '../../theme';
import { errorText } from './format';

/**
 * Reporte con motivo (y detalle opcional). Con "alguien podría estar en
 * riesgo" ofrece además, al terminar, el acceso a las líneas de apoyo.
 */
export default function ReportSheet({ visible, title, onClose, onSubmit, onSeeSupport }) {
  const { t } = useApp();
  const [reason, setReason] = useState(null);
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (visible) { setReason(null); setDetail(''); setSending(false); setError(null); setDone(false); }
  }, [visible]);

  const send = async () => {
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit(reason, detail);
      setDone(true);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <Sheet visible={visible} onClose={onClose} title={t.socReportThanks}>
        {reason === 'self_harm' ? (
          <>
            <Text variant="subhead" color={COLORS.secondaryLabel} style={styles.note}>{t.socReportSelfHarmNote}</Text>
            <Button variant="filled" style={[styles.sosBtn, { marginBottom: SPACING.sm }]} onPress={() => { onClose(); setTimeout(onSeeSupport, 250); }}>
              {t.socSeeSupport}
            </Button>
          </>
        ) : null}
        <Button variant="filled" onPress={onClose}>{t.socDone}</Button>
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title ?? t.socReportTitle} subtitle={t.socReportSub}>
      {REPORT_REASONS.map(r => (
        <TouchableOpacity
          key={r}
          style={[styles.reason, reason === r && styles.reasonActive]}
          onPress={() => setReason(r)}
          accessibilityRole="radio"
          accessibilityState={{ selected: reason === r }}
        >
          <View style={[styles.radio, reason === r && styles.radioActive]} />
          <Text variant="body" style={styles.reasonText}>{t.socReportReasons[r]}</Text>
        </TouchableOpacity>
      ))}
      {reason ? (
        <TextArea
          value={detail}
          onChangeText={setDetail}
          placeholder={t.socReportDetailPlaceholder}
          style={styles.input}
          minHeight={70}
          maxLength={LIMITS.reportDetail}
        />
      ) : null}
      {error ? <Text variant="footnote" color={COLORS.destructive} style={styles.error}>{error}</Text> : null}
      <Button variant="filled" disabled={!reason || sending} loading={sending} onPress={send} style={styles.primary}>
        {t.socReportSend}
      </Button>
      <Button variant="plain" onPress={onClose}>{t.socCancel}</Button>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  reason: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm, marginBottom: SPACING.xs, backgroundColor: COLORS.fill,
  },
  reasonActive: { backgroundColor: COLORS.accentTint },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: COLORS.tertiaryLabel },
  radioActive: { borderColor: COLORS.accent, borderWidth: 6 },
  reasonText: { flex: 1 },
  input: { marginTop: SPACING.xs },
  error: { marginTop: SPACING.xs },
  note: { marginBottom: SPACING.sm, lineHeight: 19 },
  primary: { marginTop: SPACING.md },
  sosBtn: { backgroundColor: COLORS.sos },
});
