import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Header from '../../components/social/Header';
import KeyboardScreen from '../../components/KeyboardScreen';
import Avatar from '../../components/social/Avatar';
import Text from '../../ui/Text';
import { TextArea } from '../../ui/TextField';
import { errorText, fmt } from '../../components/social/format';
import { useApp } from '../../context/AppContext';
import { startConversation } from '../../data/messages';
import { LIMITS } from '../../data/socialCore';
import { COLORS, RADIUS, SPACING } from '../../theme';
import { showAlert } from '../../components/dialogs';

/**
 * El primer mensaje ES la solicitud (params { publicId, other }): se manda
 * una sola vez, así que vive en su propia hoja modal — no en ChatScreen, que
 * nunca deja escribir mientras la conversación sigue pendiente (ver
 * ChatScreen). Al enviar, reemplaza esta pantalla por el chat.
 *
 * Si el filtro rechaza el texto (acoso/amenaza o datos personales), se queda
 * aquí con el motivo explicado: quien escribe puede corregir y reintentar.
 * Si es crisis, se manda igual y se avisa con acceso directo al SOS.
 */
export default function MessageRequestScreen({ navigation, route }) {
  const { t, sessionToken } = useApp();
  const other = route.params?.other ?? null;
  const publicId = route.params?.publicId ?? other?.publicId;

  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [blockedReason, setBlockedReason] = useState(null);

  const dirty = body.trim().length > 0;
  const allowLeave = useRef(false);

  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (allowLeave.current || !dirty) return;
    e.preventDefault();
    showAlert(t.socDiscardTitle, t.socDiscardBody, [
      { text: t.socKeepWriting, style: 'cancel' },
      { text: t.socDiscard, style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
    ]);
  }), [navigation, dirty, t]);

  const close = () => navigation.goBack();

  const trimmed = body.trim();
  const canSend = trimmed.length > 0 && body.length <= LIMITS.messageBody && !sending && !!publicId;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    setBlockedReason(null);
    try {
      const { conversation, moderation } = await startConversation(sessionToken, { publicId, body: trimmed });
      allowLeave.current = true;
      navigation.replace('Chat', {
        conversationId: conversation.id,
        other: conversation.other ?? other,
        status: conversation.status,
        crisisJustSent: moderation?.reason === 'crisis',
      });
    } catch (e) {
      if (e.code === 'mensaje_no_entregado') {
        setBlockedReason(e.reason === 'acoso_o_amenaza' ? t.socMessageBlockedHarassment : t.socMessageBlockedPersonalInfo);
      } else {
        setError(errorText(e, t, 'message'));
      }
    } finally {
      setSending(false);
    }
  };

  const counterNear = body.length > LIMITS.messageBody * 0.9;

  return (
    <View style={styles.container}>
      <Header
        title={t.socSendMessage}
        leftLabel={t.socCancel}
        onLeftPress={close}
        rightLabel={t.socSend}
        onRightPress={submit}
        rightDisabled={!canSend}
        rightLoading={sending}
      />
      <KeyboardScreen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.identity}>
            <Avatar author={other} size={56} />
            <Text variant="title3">{other?.displayName ?? t.socAnonymous}</Text>
          </View>
          <Text variant="footnote" color={COLORS.secondaryLabel} style={styles.hint}>{t.socMessageRequestHint}</Text>
          <View style={styles.inputCard}>
            <TextArea
              value={body}
              onChangeText={setBody}
              placeholder={t.socMessagePlaceholder}
              style={styles.input}
              minHeight={120}
              maxLength={LIMITS.messageBody}
              autoFocus
              editable={!sending}
            />
            <Text variant="caption1" color={counterNear ? COLORS.destructive : COLORS.tertiaryLabel} style={styles.counter}>
              {fmt(t.socCharCount, { n: body.length, max: LIMITS.messageBody })}
            </Text>
          </View>

          {blockedReason ? (
            <View style={styles.blockedCard}>
              <Text variant="headline" color={COLORS.destructive}>{t.socMessageBlockedTitle}</Text>
              <Text variant="subhead" color={COLORS.secondaryLabel} style={{ marginTop: 4, lineHeight: 19 }}>{blockedReason}</Text>
            </View>
          ) : null}
          {error ? <Text variant="subhead" color={COLORS.destructive} style={styles.error}>{error}</Text> : null}

          <Text variant="footnote" color={COLORS.tertiaryLabel} style={styles.privacyNote}>{t.socMessagesEnableFooter}</Text>
        </ScrollView>
      </KeyboardScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xl },
  identity: { alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
  hint: { textAlign: 'center' },
  inputCard: { backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, padding: SPACING.md },
  input: { fontSize: 16, lineHeight: 23, backgroundColor: 'transparent' },
  counter: { alignSelf: 'flex-end', marginTop: SPACING.xs },
  blockedCard: { backgroundColor: COLORS.tones.rose.bg, borderRadius: RADIUS.md, padding: SPACING.md },
  error: { textAlign: 'center' },
  privacyNote: { lineHeight: 16, marginTop: SPACING.sm },
});
