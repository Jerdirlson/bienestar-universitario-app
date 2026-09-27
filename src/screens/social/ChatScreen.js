import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardScreen from '../../components/KeyboardScreen';
import Header from '../../components/social/Header';
import ReportSheet from '../../components/social/ReportSheet';
import { OptionSheet } from '../../components/social/Sheet';
import { StateView, MoreButton } from '../../components/social/ui';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import Icon from '../../ui/Icon';
import { TextArea } from '../../ui/TextField';
import { errorText, timeAgo } from '../../components/social/format';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import {
  getConversation, listMessages, sendMessage, acceptConversation, rejectConversation,
  markConversationRead, reportMessage,
} from '../../data/messages';
import { blockUser } from '../../data/users';
import { LIMITS } from '../../data/socialCore';
import { COLORS, RADIUS, SPACING } from '../../theme';
import { showAlert } from '../../components/dialogs';

/**
 * Chat de una conversación (params { conversationId, other?, status?,
 * crisisJustSent? }). Estilo Mensajes de iOS: burbujas propias a la derecha
 * en `accentTint`, ajenas a la izquierda en `fill`; campo anclado sobre el
 * teclado (§8, KeyboardScreen).
 *
 * Mientras la conversación sigue `pending` NUNCA hay campo de texto: quien
 * la pidió ya usó su único mensaje (MessageRequestScreen) y espera; quien la
 * recibió ve Aceptar/Rechazar en su lugar. `rejected` es de solo lectura.
 */
export default function ChatScreen({ route, navigation }) {
  const { t, lang, sessionToken } = useApp();
  const { refreshUnreadMessages, showToast, subscribe } = useSocial();
  const insets = useSafeAreaInsets();
  const conversationId = route.params?.conversationId;
  const initialOther = route.params?.other ?? null;

  const [conversation, setConversation] = useState(
    initialOther ? { other: initialOther, status: route.params?.status ?? 'pending', requestedByMe: false } : null
  );
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [blockedReason, setBlockedReason] = useState(null);
  const [crisisNote, setCrisisNote] = useState(!!route.params?.crisisJustSent);
  const [decideBusy, setDecideBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [conv, msgs] = await Promise.all([
        getConversation(sessionToken, conversationId),
        listMessages(sessionToken, conversationId),
      ]);
      setConversation(conv);
      setMessages(msgs.messages);
    } catch (e) {
      setLoadError(e);
    } finally {
      setLoading(false);
    }
  }, [sessionToken, conversationId]);

  useEffect(() => { load(); }, [load]);

  // Aviso en tiempo real (SocialContext, canal /ws) de un mensaje nuevo EN
  // ESTA conversación: se vuelve a pedir sin el parpadeo de `loading`, para
  // no esperar el sondeo de respaldo. Sin contenido en el aviso — igual que
  // cualquier otro refresco, se pide por HTTP con la sesión ya validada.
  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'realtime:message' && event.conversationId === conversationId) {
        listMessages(sessionToken, conversationId).then((r) => setMessages(r.messages)).catch(() => {});
      }
    });
  }, [subscribe, sessionToken, conversationId]);

  // Marcar leído al abrir una conversación ya aceptada.
  useEffect(() => {
    if (!loading && conversation?.status === 'accepted') {
      markConversationRead(sessionToken, conversationId).then(refreshUnreadMessages).catch(() => {});
    }
  }, [loading, conversation?.status, sessionToken, conversationId, refreshUnreadMessages]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setSendError(null);
    setBlockedReason(null);
    try {
      const { message, moderation } = await sendMessage(sessionToken, conversationId, trimmed);
      setMessages((prev) => [...prev, message]);
      setText('');
      if (moderation?.reason === 'crisis') setCrisisNote(true);
    } catch (e) {
      if (e.code === 'mensaje_no_entregado') {
        setBlockedReason(e.reason === 'acoso_o_amenaza' ? t.socMessageBlockedHarassment : t.socMessageBlockedPersonalInfo);
      } else {
        setSendError(errorText(e, t, 'message'));
      }
    } finally {
      setSending(false);
    }
  };

  const decide = async (accept) => {
    if (decideBusy) return;
    setDecideBusy(true);
    try {
      if (accept) {
        const updated = await acceptConversation(sessionToken, conversationId);
        setConversation(updated);
        showToast(t.socMessageRequestAccepted);
        refreshUnreadMessages();
      } else {
        await rejectConversation(sessionToken, conversationId);
        showToast(t.socMessageRequestRejected);
        refreshUnreadMessages();
        navigation.goBack();
      }
    } catch (e) {
      showAlert(t.socErrTitle, errorText(e, t, 'message'));
    } finally {
      setDecideBusy(false);
    }
  };

  const confirmBlock = () => {
    const publicId = conversation?.other?.publicId;
    if (!publicId) return;
    showAlert(t.socBlockTitle, t.socBlockBody, [
      { text: t.socCancel, style: 'cancel' },
      {
        text: t.socBlockConfirm,
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(sessionToken, publicId);
            showToast(t.socBlockDone);
            navigation.goBack();
          } catch (e) {
            showAlert(t.socErrTitle, errorText(e, t));
          }
        },
      },
    ]);
  };

  const goSos = () => navigation.navigate('Sos');

  const renderMessage = ({ item }) => (
    <MessageBubble
      message={item}
      t={t}
      lang={lang}
      onReport={() => !item.isOwn && !item.removed && setReportTarget(item)}
      onSeeSupport={goSos}
    />
  );

  const other = conversation?.other ?? initialOther;
  const status = conversation?.status;
  const canType = status === 'accepted';
  const showDecideBar = status === 'pending' && conversation?.requestedByMe === false;

  return (
    <View style={styles.container}>
      <Header
        title={other?.displayName ?? t.socAnonymous}
        onBack={() => navigation.goBack()}
        right={other?.publicId ? <MoreButton onPress={() => setMenu(true)} label={t.socOptions} /> : null}
      />

      {loading || loadError ? (
        <StateView loading={loading} error={loadError ? errorText(loadError, t, 'message') : null} onRetry={load} />
      ) : (
        <KeyboardScreen>
          <FlatList
            data={messages}
            keyExtractor={(m) => String(m.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: SPACING.xs }} />}
          />

          {status === 'pending' && conversation?.requestedByMe ? (
            <View style={[styles.noteBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
              <Icon name="time-outline" size={16} color={COLORS.secondaryLabel} />
              <Text variant="footnote" color={COLORS.secondaryLabel} style={{ flex: 1 }}>{t.socMessageWaitingAccept}</Text>
            </View>
          ) : null}

          {status === 'rejected' ? (
            <View style={[styles.noteBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
              <Icon name="hand-left-outline" size={16} color={COLORS.secondaryLabel} />
              <Text variant="footnote" color={COLORS.secondaryLabel} style={{ flex: 1 }}>{t.socMessageRejectedNote}</Text>
            </View>
          ) : null}

          {showDecideBar ? (
            <View style={[styles.decideBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
              <Button variant="tinted" style={{ flex: 1 }} onPress={() => decide(false)} disabled={decideBusy} loading={decideBusy}>
                {t.socReject}
              </Button>
              <Button variant="filled" style={{ flex: 1 }} onPress={() => decide(true)} disabled={decideBusy} loading={decideBusy}>
                {t.socAccept}
              </Button>
            </View>
          ) : null}

          {canType ? (
            <View style={[styles.composer, { paddingBottom: insets.bottom + SPACING.sm }]}>
              {blockedReason ? (
                <View style={styles.blockedCard}>
                  <Text variant="footnote" color={COLORS.destructive} style={{ fontWeight: '600' }}>{t.socMessageBlockedTitle}</Text>
                  <Text variant="footnote" color={COLORS.destructive}>{blockedReason}</Text>
                </View>
              ) : null}
              <View style={styles.inputRow}>
                <TextArea
                  value={text}
                  onChangeText={setText}
                  placeholder={t.socMessagePlaceholder}
                  style={styles.input}
                  minHeight={42}
                  maxLength={LIMITS.messageBody}
                  editable={!sending}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!text.trim() || sending) && styles.disabled]}
                  disabled={!text.trim() || sending}
                  onPress={send}
                  accessibilityLabel={t.socSend}
                >
                  {sending ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="arrow-up" size={18} color="#fff" />}
                </TouchableOpacity>
              </View>
              {sendError ? <Text variant="footnote" color={COLORS.destructive}>{sendError}</Text> : null}
            </View>
          ) : null}
        </KeyboardScreen>
      )}

      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        cancelLabel={t.socCancel}
        options={[
          ...(other?.publicId ? [{ key: 'profile', label: t.socViewProfile, onPress: () => navigation.navigate('UserProfile', { publicId: other.publicId }) }] : []),
          { key: 'block', label: t.socBlockAuthor, destructive: true, onPress: confirmBlock },
        ]}
      />

      <ReportSheet
        visible={!!reportTarget}
        title={t.socReportMessage}
        onClose={() => setReportTarget(null)}
        onSubmit={async (reason, detail) => {
          await reportMessage(sessionToken, reportTarget.id, reason, detail);
          showToast(t.socMessageReported);
        }}
        onSeeSupport={goSos}
      />

      <CrisisModal visible={crisisNote} t={t} onSos={() => { setCrisisNote(false); goSos(); }} onClose={() => setCrisisNote(false)} />
    </View>
  );
}

/**
 * Burbuja propia o ajena. Un mensaje de riesgo alto ('crisis') muestra un
 * aviso cálido solo del lado de quien lo recibe. Reportar es un toque en la
 * banderita junto a la hora de un mensaje ajeno — no hace falta un menú:
 * "reportar en un toque" (CLAUDE.md).
 */
function MessageBubble({ message, t, lang, onReport, onSeeSupport }) {
  return (
    <View style={[styles.bubbleRow, message.isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
      <View style={[styles.bubble, message.isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text variant="body" color={COLORS.label} style={message.removed ? { fontStyle: 'italic', color: COLORS.tertiaryLabel } : null}>
          {message.removed ? t.socMessageRemoved : message.body}
        </Text>
      </View>
      <View style={styles.bubbleMeta}>
        <Text variant="caption2" color={COLORS.tertiaryLabel}>{timeAgo(message.createdAt, t, lang)}</Text>
        {!message.isOwn && !message.removed ? (
          <TouchableOpacity onPress={onReport} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.socReportMessage}>
            <Icon name="flag-outline" size={12} color={COLORS.tertiaryLabel} />
          </TouchableOpacity>
        ) : null}
      </View>
      {!message.isOwn && message.risk === 'high' && !message.removed ? (
        <TouchableOpacity onPress={onSeeSupport} style={styles.crisisNote} accessibilityRole="button">
          <Icon name="heart" size={14} color={COLORS.sos} />
          <Text variant="caption1" color={COLORS.secondaryLabel} style={{ flex: 1 }}>{t.socMessageCrisisRecipientNote}</Text>
          <Text variant="caption1" color={COLORS.accent}>{t.socSeeSupport}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Igual tono que ModerationModal (posts), adaptado: el mensaje SÍ se entregó, esto es solo el acceso al SOS para quien lo escribió. */
function CrisisModal({ visible, t, onSos, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard} accessibilityViewIsModal>
          <View style={[styles.modalIcon, { backgroundColor: COLORS.tones.rose.bg }]}>
            <Icon name="heart" size={28} color={COLORS.sos} />
          </View>
          <Text variant="title2" style={{ textAlign: 'center' }}>{t.socResultCrisisTitle}</Text>
          <Text variant="body" color={COLORS.secondaryLabel} style={{ textAlign: 'center', lineHeight: 21 }}>{t.socResultCrisisBody}</Text>
          <Button variant="filled" style={{ alignSelf: 'stretch', backgroundColor: COLORS.sos, marginTop: SPACING.xs }} onPress={onSos}>
            {t.socResultCrisisSos}
          </Button>
          <Text variant="footnote" color={COLORS.tertiaryLabel} style={{ textAlign: 'center', lineHeight: 17 }}>{t.socResultCrisisNote}</Text>
          <Button variant="plain" onPress={onClose}>{t.socResultCrisisLater}</Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  list: { padding: SPACING.lg, gap: SPACING.xs, flexGrow: 1, justifyContent: 'flex-end' },
  bubbleRow: { maxWidth: '82%', gap: 2 },
  bubbleRowOwn: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    borderRadius: RADIUS.lg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  bubbleOwn: { backgroundColor: COLORS.accentTint },
  bubbleOther: { backgroundColor: COLORS.fill },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: SPACING.xs },
  crisisNote: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 2,
    backgroundColor: COLORS.tones.rose.bg, borderRadius: RADIUS.sm, padding: SPACING.sm, maxWidth: '100%',
  },
  noteBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgElevated, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.separator,
  },
  decideBar: {
    flexDirection: 'row', gap: SPACING.sm,
    backgroundColor: COLORS.bgElevated, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.separator,
  },
  composer: {
    backgroundColor: COLORS.bgElevated, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.separator,
  },
  blockedCard: { backgroundColor: COLORS.tones.rose.bg, borderRadius: RADIUS.sm, padding: SPACING.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm },
  input: { flex: 1, maxHeight: 120, borderRadius: 21 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  modalCard: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.xl, padding: SPACING.xl, width: '100%', maxWidth: 420,
    alignItems: 'center', gap: SPACING.sm,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  modalIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs },
});
