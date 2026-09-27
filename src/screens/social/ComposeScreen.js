import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Header from '../../components/social/Header';
import KeyboardScreen from '../../components/KeyboardScreen';
import MoodFace from '../../components/MoodFace';
import ModerationModal from '../../components/social/ModerationModal';
import IdentityPicker from '../../components/social/IdentityPicker';
import { StateView } from '../../components/social/ui';
import Text from '../../ui/Text';
import Chip from '../../ui/Chip';
import { TextArea } from '../../ui/TextField';
import { errorText, fmt } from '../../components/social/format';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import { createPost, updatePost, getPost } from '../../data/community';
import { TOPICS, LIMITS } from '../../data/socialCore';
import { COLORS, RADIUS, SPACING } from '../../theme';
import { showAlert } from '../../components/dialogs';

/**
 * Publicar o editar (params { postId?, post? }), como una hoja modal de iOS:
 * barra superior Cancelar / Publicar (§5, §8 — la acción principal siempre
 * visible, sin depender de dónde quede el teclado).
 *
 * Resultado de moderación:
 * - published → vuelve al feed y el post aparece arriba.
 * - held/review → explica que lo revisará un moderador.
 * - held/crisis → mensaje empático con acceso directo a Sos. Esto es lo más
 *   importante de la pantalla: el botón reemplaza Compose por Sos sin
 *   depender de nada más.
 */
export default function ComposeScreen({ navigation, route }) {
  const { t, sessionToken } = useApp();
  const { isV1, me, emit, showToast } = useSocial();
  const editingId = route.params?.postId ?? null;
  const initial = route.params?.post ?? null;

  const [body, setBody] = useState(initial?.body ?? '');
  const [originalBody, setOriginalBody] = useState(initial?.body ?? '');
  const [topic, setTopic] = useState(initial?.topic ?? 'general');
  const [mood, setMood] = useState(initial?.mood ?? null);
  const [anonymous, setAnonymous] = useState(true);
  const [loading, setLoading] = useState(!!editingId && !initial);
  const [loadError, setLoadError] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!editingId || initial) return;
    let cancelled = false;
    getPost(sessionToken, editingId)
      .then(p => {
        if (cancelled) return;
        setBody(p.body); setOriginalBody(p.body); setTopic(p.topic ?? 'general'); setMood(p.mood);
      })
      .catch(e => !cancelled && setLoadError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [editingId, initial, sessionToken]);

  const alias = me?.displayName ?? null;
  const trimmed = body.trim();
  const dirty = editingId ? trimmed !== originalBody.trim() : trimmed.length > 0;
  const canSend = trimmed.length > 0 && body.length <= LIMITS.postBody && !sending;

  // Salir con texto sin enviar (botón cancelar, atrás de Android o gesto) pide
  // confirmación. Tras enviar, allowLeave deja salir sin preguntar.
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

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const draft = { body: trimmed, mood, topic: isV1 ? undefined : topic };
      const r = editingId
        ? await updatePost(sessionToken, editingId, draft)
        : await createPost(sessionToken, { ...draft, isAnonymous: anonymous || !alias });
      allowLeave.current = true;
      if (r.post) emit(editingId ? { type: 'post', post: r.post } : { type: 'postCreated', post: r.post });
      if (r.moderation.outcome === 'published') {
        // Al editar no se "publica" nada nuevo: el aviso dice que se guardó.
        showToast(editingId ? t.socPostUpdated : t.socPublished);
        navigation.goBack();
      } else {
        setResult(r.moderation);
      }
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setSending(false);
    }
  };

  const goSos = () => {
    allowLeave.current = true;
    setResult(null);
    // Reemplaza Compose: al cerrar Sos se vuelve al feed, no al formulario.
    navigation.replace('Sos');
  };

  const counterNear = body.length > LIMITS.postBody * 0.9;

  return (
    <View style={styles.container}>
      <Header
        title={editingId ? t.socEditTitle : t.socComposeTitle}
        leftLabel={t.socCancel}
        onLeftPress={close}
        rightLabel={editingId ? t.socSaveChanges : t.socPublish}
        onRightPress={submit}
        rightDisabled={!canSend}
        rightLoading={sending}
      />
      {loading || loadError ? (
        <StateView loading={loading} error={loadError ? errorText(loadError, t) : null} />
      ) : (
        <KeyboardScreen>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.inputCard}>
              <TextArea
                testID="compose-body"
                value={body}
                onChangeText={setBody}
                placeholder={t.socComposePlaceholder}
                style={styles.input}
                minHeight={150}
                maxLength={LIMITS.postBody}
                autoFocus={!editingId}
                editable={!sending}
              />
              <Text variant="caption1" color={counterNear ? COLORS.destructive : COLORS.tertiaryLabel} style={styles.counter}>
                {fmt(t.socCharCount, { n: body.length, max: LIMITS.postBody })}
              </Text>
            </View>

            {!isV1 ? (
              <>
                <Text variant="headline" style={styles.label}>{t.socTopicPrompt}</Text>
                <View style={styles.chipsRow}>
                  {TOPICS.map(k => (
                    <Chip key={k} selected={topic === k} onPress={() => setTopic(k)}>{t.socTopics[k]}</Chip>
                  ))}
                </View>
              </>
            ) : null}

            <Text variant="headline" style={styles.label}>{t.socMoodPrompt}</Text>
            <View style={styles.moodRow}>
              {[0, 1, 2, 3, 4].map(i => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setMood(mood === i ? null : i)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: mood === i }}
                  accessibilityLabel={t.moods?.[i]}
                  style={styles.moodBtn}
                >
                  <MoodFace level={i} size={40} bordered={mood === i} muted={mood !== null && mood !== i} />
                  <Text variant="caption2" color={mood === i ? COLORS.label : COLORS.tertiaryLabel} numberOfLines={1}>{t.moods?.[i]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!editingId ? (
              <>
                <Text variant="headline" style={styles.label}>{t.socIdentityPrompt}</Text>
                <IdentityPicker
                  anonymous={anonymous || !alias}
                  onChange={setAnonymous}
                  alias={alias}
                  avatar={me}
                  onSetAlias={() => navigation.navigate('EditProfile')}
                />
              </>
            ) : (
              <Text variant="footnote" color={COLORS.secondaryLabel} style={styles.note}>{t.socEditNote}</Text>
            )}

            <View style={styles.guidelines}>
              <Text variant="footnote" color={COLORS.secondaryLabel} style={styles.guidelinesText}>{t.socGuidelinesNote}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('CommunityGuidelines')}>
                <Text variant="footnote" color={COLORS.accent}>{t.socGuidelinesLink}</Text>
              </TouchableOpacity>
            </View>

            {error ? <Text variant="subhead" color={COLORS.destructive} style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </KeyboardScreen>
      )}

      <ModerationModal
        result={result}
        kind="post"
        onSos={goSos}
        onClose={() => { setResult(null); navigation.goBack(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xl },
  inputCard: { backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, padding: SPACING.md },
  input: { fontSize: 16, lineHeight: 23, backgroundColor: 'transparent' },
  counter: { alignSelf: 'flex-end', marginTop: SPACING.xs },
  label: { marginTop: SPACING.xs },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: { alignItems: 'center', gap: 4, width: '19%' },
  note: { lineHeight: 17 },
  guidelines: { backgroundColor: COLORS.accentTint, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.xs, marginTop: SPACING.xs },
  guidelinesText: { lineHeight: 17 },
  error: { textAlign: 'center' },
});
