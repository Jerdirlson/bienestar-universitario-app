import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../../components/TopBar';
import KeyboardScreen from '../../components/KeyboardScreen';
import MoodFace from '../../components/MoodFace';
import ModerationModal from '../../components/social/ModerationModal';
import IdentityPicker from '../../components/social/IdentityPicker';
import { TopicChips, StateView } from '../../components/social/ui';
import { errorText, fmt } from '../../components/social/format';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import { createPost, updatePost, getPost } from '../../data/community';
import { TOPICS, LIMITS } from '../../data/socialCore';
import { COLORS, FONTS, RADIUS } from '../../theme';
import { showAlert } from '../../components/dialogs';

/**
 * Publicar o editar (params { postId?, post? }).
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
  const insets = useSafeAreaInsets();
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

  // Salir con texto sin enviar (botón cerrar, atrás de Android o gesto) pide
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
      <TopBar title={editingId ? t.socEditTitle : t.socComposeTitle} onClose={close} />
      {loading || loadError ? (
        <StateView loading={loading} error={loadError ? errorText(loadError, t) : null} />
      ) : (
        <KeyboardScreen>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.inputCard}>
              <TextInput
                testID="compose-body"
                value={body}
                onChangeText={setBody}
                placeholder={t.socComposePlaceholder}
                placeholderTextColor={COLORS.inkMuted}
                style={styles.input}
                multiline
                maxLength={LIMITS.postBody}
                autoFocus={!editingId}
                editable={!sending}
                textAlignVertical="top"
              />
              <Text style={[styles.counter, counterNear && { color: '#D93B4A' }]}>
                {fmt(t.socCharCount, { n: body.length, max: LIMITS.postBody })}
              </Text>
            </View>

            {!isV1 ? (
              <>
                <Text style={styles.label}>{t.socTopicPrompt}</Text>
                <TopicChips topics={TOPICS} labels={t.socTopics} value={topic} onChange={setTopic} />
              </>
            ) : null}

            <Text style={styles.label}>{t.socMoodPrompt}</Text>
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
                  <Text style={[styles.moodLabel, mood === i && { color: COLORS.ink }]} numberOfLines={1}>{t.moods?.[i]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!editingId ? (
              <>
                <Text style={styles.label}>{t.socIdentityPrompt}</Text>
                <IdentityPicker
                  anonymous={anonymous || !alias}
                  onChange={setAnonymous}
                  alias={alias}
                  avatar={me}
                  onSetAlias={() => navigation.navigate('EditProfile')}
                />
              </>
            ) : (
              <Text style={styles.note}>{t.socEditNote}</Text>
            )}

            <View style={styles.guidelines}>
              <Text style={styles.guidelinesText}>{t.socGuidelinesNote}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('CommunityGuidelines')}>
                <Text style={styles.guidelinesLink}>{t.socGuidelinesLink}</Text>
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              style={[styles.publish, !canSend && styles.disabled]}
              disabled={!canSend}
              onPress={submit}
              accessibilityRole="button"
            >
              {sending ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.publishText}>{editingId ? t.socSaveChanges : t.socPublish}</Text>
              )}
            </TouchableOpacity>
          </View>
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
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  inputCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.hair },
  input: { minHeight: 150, fontFamily: FONTS.uiRegular, fontSize: 16, color: COLORS.ink, lineHeight: 23 },
  counter: { alignSelf: 'flex-end', fontFamily: FONTS.uiMedium, fontSize: 11, color: COLORS.inkMuted, marginTop: 6 },
  label: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.ink, marginTop: 4 },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: { alignItems: 'center', gap: 4, width: '19%' },
  moodLabel: { fontFamily: FONTS.uiMedium, fontSize: 10, color: COLORS.inkMuted },
  note: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, lineHeight: 17 },
  guidelines: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: 12, gap: 6, marginTop: 4 },
  guidelinesText: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft, lineHeight: 17 },
  guidelinesLink: { fontFamily: FONTS.uiBold, fontSize: 12, color: COLORS.primary },
  error: { fontFamily: FONTS.uiSemiBold, fontSize: 13, color: '#D93B4A', textAlign: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: COLORS.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.hair },
  publish: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center' },
  publishText: { fontFamily: FONTS.extraBold, fontSize: 16, color: '#fff', letterSpacing: 0.3 },
  disabled: { opacity: 0.5 },
});
