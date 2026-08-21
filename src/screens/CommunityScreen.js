import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import MoodFace from '../components/MoodFace';
import TopBar from '../components/TopBar';
import { useApp } from '../context/AppContext';
import {
  listPosts, createPost, deletePost,
  reactToPost, unreactToPost, reportPost,
} from '../data/community';
import { COLORS, FONTS, SHADOW } from '../theme';

const REPORT_REASONS = ['self_harm', 'harassment', 'spam', 'other'];

function relativeTime(iso, t) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.round(diffMs / 60000));
  if (min < 60) return `${t.timeAgoPrefix ?? ''}${min} ${t.minutesAgo}`.trim();
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} ${t.hoursAgo}`;
  return `${Math.round(hr / 24)} ${t.daysAgo}`;
}

export default function CommunityScreen({ navigation }) {
  const { t, sessionToken, userName } = useApp();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [composing, setComposing] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [composeMood, setComposeMood] = useState(2);
  const [composeAnonymous, setComposeAnonymous] = useState(true);
  const [posting, setPosting] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!sessionToken) return;
    setLoadError(false);
    try {
      const fresh = await listPosts(sessionToken);
      setPosts(fresh);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const handlePublish = async () => {
    const body = composeText.trim();
    if (!body) return;
    setPosting(true);
    try {
      await createPost(sessionToken, { body, mood: composeMood, isAnonymous: composeAnonymous });
      setComposeText('');
      setComposing(false);
      await loadFeed();
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
      await loadFeed();
    } catch {
      Alert.alert(t.communityErrorTitle, t.communityErrorBody);
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleReact = (post) =>
    withBusy(post.id, () => (post.reacted_by_me ? unreactToPost(sessionToken, post.id) : reactToPost(sessionToken, post.id)));

  const handleDelete = (post) => {
    Alert.alert(t.deleteConfirmTitle, t.deleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deletePost, style: 'destructive', onPress: () => withBusy(post.id, () => deletePost(sessionToken, post.id)) },
    ]);
  };

  const handleReport = (post) => {
    Alert.alert(t.reportPost, t.reportReasonPrompt, [
      { text: t.reportReasonSelfHarm, onPress: () => withBusy(post.id, () => reportPost(sessionToken, post.id, 'self_harm')) },
      { text: t.reportReasonHarassment, onPress: () => withBusy(post.id, () => reportPost(sessionToken, post.id, 'harassment')) },
      { text: t.reportReasonSpam, onPress: () => withBusy(post.id, () => reportPost(sessionToken, post.id, 'spam')) },
      { text: t.reportReasonOther, onPress: () => withBusy(post.id, () => reportPost(sessionToken, post.id, 'other')) },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <TopBar title={t.community} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.subHeader}>{t.supportive}</Text>

        <TouchableOpacity style={styles.newPost} onPress={() => setComposing(v => !v)}>
          <View style={styles.newPostIcon}>
            <Svg width="16" height="16" viewBox="0 0 16 16">
              <Path d="M8 2v12M2 8h12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.newPostTitle}>{t.anonymousPost}</Text>
            <Text style={styles.newPostSub}>{t.shareFeeling}</Text>
          </View>
        </TouchableOpacity>

        {composing && (
          <View style={styles.composeBox}>
            <View style={styles.composeMoodRow}>
              {[0, 1, 2, 3, 4].map(i => (
                <TouchableOpacity key={i} onPress={() => setComposeMood(i)}>
                  <MoodFace level={i} size={36} bordered={i === composeMood} />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={composeText}
              onChangeText={setComposeText}
              placeholder={t.composePlaceholder}
              placeholderTextColor={COLORS.inkMuted}
              style={styles.composeInput}
              multiline
              maxLength={2000}
              editable={!posting}
            />

            <View style={styles.anonRow}>
              <TouchableOpacity
                style={[styles.anonPill, composeAnonymous && styles.anonPillActive]}
                onPress={() => setComposeAnonymous(true)}
              >
                <Text style={[styles.anonPillText, composeAnonymous && styles.anonPillTextActive]}>{t.anonymousLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.anonPill, !composeAnonymous && styles.anonPillActive, !userName && styles.btnDisabled]}
                disabled={!userName}
                onPress={() => setComposeAnonymous(false)}
              >
                <Text style={[styles.anonPillText, !composeAnonymous && styles.anonPillTextActive]}>
                  {userName ?? t.setDisplayName}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.publishBtn, (!composeText.trim() || posting) && styles.btnDisabled]}
              disabled={!composeText.trim() || posting}
              onPress={handlePublish}
            >
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishBtnText}>{t.publish}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {loading && <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />}
        {!loading && loadError && <Text style={styles.emptyText}>{t.communityErrorBody}</Text>}
        {!loading && !loadError && posts.length === 0 && <Text style={styles.emptyText}>{t.communityEmpty}</Text>}

        {posts.map((p) => (
          <View key={p.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <MoodFace level={p.mood ?? 2} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.postName}>{p.author_name ?? t.anonymousLabel}</Text>
                <Text style={styles.postTime}>{relativeTime(p.created_at, t)}</Text>
              </View>
              {p.is_own && p.status === 'pending' && (
                <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{t.pendingBadge}</Text></View>
              )}
            </View>
            <Text style={styles.postBody}>{p.body}</Text>

            <View style={styles.postActions}>
              <TouchableOpacity
                style={styles.actionItem}
                disabled={p.status !== 'published' || busyId === p.id}
                onPress={() => handleToggleReact(p)}
              >
                <Svg width="16" height="16" viewBox="0 0 16 16" fill={p.reacted_by_me ? COLORS.upbRed : 'none'}>
                  <Path d="M8 14s-5-3-5-7a3 3 0 015-2 3 3 0 015 2c0 4-5 7-5 7z" stroke={p.reacted_by_me ? COLORS.upbRed : COLORS.inkSoft} strokeWidth="1.5" />
                </Svg>
                <Text style={styles.actionText}>{p.reactions}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                disabled={p.status !== 'published' && !p.is_own}
                onPress={() => navigation.navigate('PostDetail', { post: p })}
              >
                <Svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <Path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H6l-3 3v-3H3a1 1 0 01-1-1V4z" stroke={COLORS.inkSoft} strokeWidth="1.5" />
                </Svg>
                <Text style={styles.actionText}>{p.comment_count}</Text>
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              {p.is_own ? (
                <TouchableOpacity disabled={busyId === p.id} onPress={() => handleDelete(p)}>
                  <Text style={styles.actionLink}>{t.deletePost}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity disabled={busyId === p.id} onPress={() => handleReport(p)}>
                  <Text style={styles.actionLink}>{t.reportPost}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        onPress={() => navigation.navigate('Sos')}
        style={styles.sosFab}
      >
        <Text style={styles.sosFabText}>SOS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 100, gap: 12 },
  subHeader: { fontFamily: FONTS.uiSemiBold, fontSize: 13, color: COLORS.inkSoft },
  newPost: {
    backgroundColor: COLORS.primarySoft, borderRadius: 18,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  newPostIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  newPostTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink },
  newPostSub: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.inkSoft },
  composeBox: { backgroundColor: COLORS.bgCard, borderRadius: 18, padding: 14, gap: 10, ...SHADOW },
  composeMoodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  composeInput: {
    borderWidth: 1, borderColor: 'rgba(26,21,35,0.12)', borderRadius: 14, padding: 12,
    fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink, minHeight: 80, textAlignVertical: 'top',
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
  emptyText: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkMuted, textAlign: 'center', marginTop: 24 },
  postCard: {
    backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 16,
    ...SHADOW,
  },
  postHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  postName: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.ink },
  postTime: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted },
  pendingBadge: { backgroundColor: COLORS.tones.sun.bg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  pendingBadgeText: { fontFamily: FONTS.uiBold, fontSize: 10, color: COLORS.tones.sun.ink },
  postBody: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink, lineHeight: 20, marginBottom: 12 },
  postActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontFamily: FONTS.uiRegular, fontSize: 13, color: COLORS.inkSoft },
  actionLink: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.inkMuted },
  sosFab: {
    position: 'absolute', right: 16, bottom: 80,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#F37171',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F37171', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  sosFabText: { fontFamily: 'Nunito_900Black', fontSize: 12, color: '#fff' },
});
