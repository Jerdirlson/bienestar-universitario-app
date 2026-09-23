import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Sheet from './Sheet';
import { useApp } from '../../context/AppContext';
import { REPORT_REASONS, LIMITS } from '../../data/socialCore';
import { COLORS, FONTS, RADIUS } from '../../theme';
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
            <Text style={styles.note}>{t.socReportSelfHarmNote}</Text>
            <TouchableOpacity style={styles.sosBtn} onPress={() => { onClose(); setTimeout(onSeeSupport, 250); }}>
              <Text style={styles.sosBtnText}>{t.socSeeSupport}</Text>
            </TouchableOpacity>
          </>
        ) : null}
        <TouchableOpacity style={styles.primary} onPress={onClose}>
          <Text style={styles.primaryText}>{t.socDone}</Text>
        </TouchableOpacity>
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
          <Text style={styles.reasonText}>{t.socReportReasons[r]}</Text>
        </TouchableOpacity>
      ))}
      {reason ? (
        <TextInput
          value={detail}
          onChangeText={setDetail}
          placeholder={t.socReportDetailPlaceholder}
          placeholderTextColor={COLORS.inkMuted}
          style={styles.input}
          multiline
          maxLength={LIMITS.reportDetail}
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.primary, (!reason || sending) && styles.disabled]} disabled={!reason || sending} onPress={send}>
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.socReportSend}</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancel} onPress={onClose}>
        <Text style={styles.cancelText}>{t.socCancel}</Text>
      </TouchableOpacity>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  reason: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: RADIUS.sm, marginBottom: 4, backgroundColor: '#F7F5FC',
  },
  reasonActive: { backgroundColor: COLORS.primarySoft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: COLORS.inkMuted },
  radioActive: { borderColor: COLORS.primary, borderWidth: 6 },
  reasonText: { fontFamily: FONTS.uiSemiBold, fontSize: 14, color: COLORS.ink, flex: 1 },
  input: {
    borderWidth: 1, borderColor: 'rgba(26,21,35,0.12)', borderRadius: RADIUS.sm, padding: 12, marginTop: 6,
    fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink, minHeight: 70, textAlignVertical: 'top',
  },
  error: { fontFamily: FONTS.uiRegular, fontSize: 12, color: '#D93B4A', marginTop: 6 },
  note: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft, lineHeight: 19, marginBottom: 10 },
  primary: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  primaryText: { fontFamily: FONTS.extraBold, fontSize: 15, color: '#fff' },
  disabled: { opacity: 0.5 },
  sosBtn: { backgroundColor: '#F37171', borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center' },
  sosBtnText: { fontFamily: FONTS.extraBold, fontSize: 15, color: '#fff' },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontFamily: FONTS.uiSemiBold, fontSize: 14, color: COLORS.inkSoft },
});
