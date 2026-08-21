import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import MoodFace from '../components/MoodFace';
import TopBar from '../components/TopBar';
import { useApp } from '../context/AppContext';
import { listComments, createComment, deleteComment } from '../data/community';
import { COLORS, FONTS, SHADOW } from '../theme';

function relativeTime(iso, t) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.round(diffMs / 60000));
  if (min < 60) return `${min} ${t.minutesAgo}`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} ${t.hoursAgo}`;
  return `${Math.round(hr / 24)} ${t.daysAgo}`;
}

export default function PostDetailScreen({ route, navigation }) {
  const { post } = route.params;
  const { t, sessionToken, userName } = useApp();

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async () => {
    setLoadError(false);
    try {
      setComments(await listComments(sessionToken, post.id));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [sessionToken, post.id]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body) return;
    setPosting(true);
    try {
      await createComment(sessionToken, post.id, { body, isAnonymous: anonymous });
      setText('');
      await loadComments();
    } catch {
      Alert.alert(t.communityErrorTitle, t.communityErrorBody);
    } finally {
      setPosting(false);
    }
  };

  const withBusy = async (id, fn) => {
    setBusyId(id);
    try {
      await fn();
      await loadComments();
    } catch {
      Alert.alert(t.communityErrorTitle, t.communityErrorBody);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (comment) => {
    Alert.alert(t.deleteConfirmTitle, t.deleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deletePost, style: 'destructive', onPress: () => withBusy(comment.id, () => deleteComment(sessionToken, comment.id)) },
    ]);
  };

  return (
    <View style={styles.container}>
      <TopBar title={t.community} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <MoodFace level={post.mood ?? 2} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.postName}>{post.author_name ?? t.anonymousLabel}</Text>
              <Text style={styles.postTime}>{relativeTime(post.created_at, t)}</Text>
            </View>
          </View>
          <Text style={styles.postBody}>{post.body}</Text>
        </View>

        <View style={styles.composeBox}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t.composePlaceholder}
            placeholderTextColor={COLORS.inkMuted}
            style={styles.composeInput}
            multiline
            maxLength={1000}
            editable={!posting}
          />
          <View style={styles.anonRow}>
            <TouchableOpacity style={[styles.anonPill, anonymous && styles.anonPillActive]} onPress={() => setAnonymous(true)}>
              <Text style={[styles.anonPillText, anonymous && styles.anonPillTextActive]}>{t.anonymousLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.anonPill, !anonymous && styles.anonPillActive, !userName && styles.btnDisabled]}
              disabled={!userName}
              onPress={() => setAnonymous(false)}
            >
              <Text style={[styles.anonPillText, !anonymous && styles.anonPillTextActive]}>{userName ?? t.setDisplayName}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.publishBtn, (!text.trim() || posting) && styles.btnDisabled]}
            disabled={!text.trim() || posting}
            onPress={handleSend}
          >
            {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishBtnText}>{t.publish}</Text>}
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />}
        {!loading && loadError && <Text style={styles.emptyText}>{t.communityErrorBody}</Text>}
        {!loading && !loadError && comments.length === 0 && <Text style={styles.emptyText}>{t.noCommentsYet}</Text>}

        {comments.map((c) => (
          <View key={c.id} style={styles.commentCard}>
            <View style={styles.commentHeader}>
              <Text style={styles.postName}>{c.author_name ?? t.anonymousLabel}</Text>
              <Text style={styles.postTime}>{relativeTime(c.created_at, t)}</Text>
              {c.is_own && c.status === 'pending' && (
                <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{t.pendingBadge}</Text></View>
              )}
            </View>
            <Text style={styles.postBody}>{c.body}</Text>

            {c.is_own && (
              <TouchableOpacity disabled={busyId === c.id} onPress={() => handleDelete(c)}>
                <Text style={styles.actionLink}>{t.deletePost}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  postCard: { backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 16, ...SHADOW },
  postHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  postName: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.ink },
  postTime: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted },
  postBody: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink, lineHeight: 20 },
  composeBox: { backgroundColor: COLORS.bgCard, borderRadius: 18, padding: 14, gap: 10, ...SHADOW },
  composeInput: {
    borderWidth: 1, borderColor: 'rgba(26,21,35,0.12)', borderRadius: 14, padding: 12,
    fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink, minHeight: 60, textAlignVertical: 'top',
  },
  anonRow: { flexDirection: 'row', gap: 8 },
  anonPill: {
    flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(26,21,35,0.12)',
  },
  anonPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  anonPillText: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.inkSoft },
  anonPillTextActive: { color: '#fff' },
  publishBtn: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 14, alignItems: 'center' },
  publishBtnText: { fontFamily: FONTS.extraBold, fontSize: 14, color: '#fff' },
  btnDisabled: { opacity: 0.5 },
  emptyText: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkMuted, textAlign: 'center', marginTop: 12 },
  commentCard: { backgroundColor: COLORS.bgCard, borderRadius: 16, padding: 14, gap: 8, ...SHADOW },
  commentHeader: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pendingBadge: { backgroundColor: COLORS.tones.sun.bg, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8, marginLeft: 'auto' },
  pendingBadgeText: { fontFamily: FONTS.uiBold, fontSize: 9, color: COLORS.tones.sun.ink },
  actionLink: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.inkMuted },
});
