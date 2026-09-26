import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import TopBar from '../components/TopBar';
import KeyboardScreen from '../components/KeyboardScreen';
import PostCard from '../components/social/PostCard';
import Avatar from '../components/social/Avatar';
import IdentityPicker from '../components/social/IdentityPicker';
import ModerationModal from '../components/social/ModerationModal';
import ReportSheet from '../components/social/ReportSheet';
import { OptionSheet } from '../components/social/Sheet';
import { StateView, MoreButton } from '../components/social/ui';
import { usePostActions } from '../components/social/hooks';
import { errorText, fmt, timeAgo } from '../components/social/format';
import { useApp } from '../context/AppContext';
import { useSocial } from '../context/SocialContext';
import {
  getPost, listComments, createComment, deleteComment, likeComment, unlikeComment,
  reportComment, blockCommentAuthor,
} from '../data/community';
import { normalizePost, threadComments, applyCommentLike, LIMITS } from '../data/socialCore';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';
import { showAlert } from '../components/dialogs';

/**
 * Detalle de una publicación con sus comentarios (respuestas de un nivel).
 * Acepta { post } (ya cargado, se muestra al instante) o { postId } (desde
 * una notificación): en ambos casos se vuelve a pedir por id.
 */
export default function PostDetailScreen({ route, navigation }) {
  const { t, lang, sessionToken } = useApp();
  const { isV1, me, emit, showToast } = useSocial();
  const insets = useSafeAreaInsets();

  const initial = useMemo(() => {
    const p = route.params?.post;
    if (!p) return null;
    return p.createdAt !== undefined ? p : normalizePost(p); // tolera objetos crudos
  }, [route.params?.post]);
  const postId = route.params?.postId ?? initial?.id;

  const [post, setPost] = useState(initial);
  const [postError, setPostError] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentsError, setCommentsError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [result, setResult] = useState(null);
  const [menuComment, setMenuComment] = useState(null);
  const [reportComment_, setReportComment] = useState(null);

  const loadPost = useCallback(async () => {
    try {
      const fresh = await getPost(sessionToken, postId);
      setPost(fresh);
      setPostError(null);
    } catch (e) {
      setPostError(e);
    }
  }, [sessionToken, postId]);

  const loadComments = useCallback(async () => {
    setCommentsError(null);
    try {
      setComments(await listComments(sessionToken, postId));
    } catch (e) {
      setCommentsError(e);
    } finally {
      setLoadingComments(false);
    }
  }, [sessionToken, postId]);

  useEffect(() => {
    if (!postId) { setPostError({ code: 'not_found' }); return; }
    loadPost();
    loadComments();
  }, [postId, loadPost, loadComments]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPost(), loadComments()]);
    setRefreshing(false);
  };

  const actions = usePostActions({
    update: setPost,
    remove: () => {},
    onDeleted: () => navigation.goBack(),
    onBlocked: () => navigation.goBack(),
  });

  const threads = useMemo(() => threadComments(comments), [comments]);
  const alias = me?.displayName ?? null;
  const canComment = post?.status === 'published';

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const r = await createComment(sessionToken, postId, {
        body, isAnonymous: anonymous || !alias, parentId: replyTo?.id,
      });
      setText('');
      setReplyTo(null);
      if (r.comment) setComments(prev => [...prev, r.comment]);
      if (r.moderation.outcome === 'published') {
        if (post) {
          const next = { ...post, commentCount: post.commentCount + 1 };
          setPost(next);
          emit({ type: 'post', post: next });
        }
      } else {
        setResult(r.moderation);
      }
    } catch (e) {
      setSendError(errorText(e, t));
    } finally {
      setSending(false);
    }
  };

  const toggleLike = async (c) => {
    const liked = !c.likedByMe;
    setComments(prev => prev.map(x => (x.id === c.id ? applyCommentLike(x, liked) : x)));
    try {
      if (liked) await likeComment(sessionToken, c.id);
      else await unlikeComment(sessionToken, c.id);
    } catch (e) {
      setComments(prev => prev.map(x => (x.id === c.id ? applyCommentLike(x, !liked) : x)));
      showToast(errorText(e, t));
    }
  };

  const confirmDeleteComment = (c) => {
    showAlert(t.socDeleteCommentTitle, t.socDeleteCommentBody, [
      { text: t.socCancel, style: 'cancel' },
      {
        text: t.socDelete, style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(sessionToken, c.id);
            // Borrar un comentario borra sus respuestas (on delete cascade):
            // el contador baja por todos los publicados que desaparecen, no
            // solo por uno, o queda desfasado del de la base.
            const gone = comments.filter(x => (x.id === c.id || x.parentId === c.id) && x.status === 'published').length;
            setComments(prev => prev.filter(x => x.id !== c.id && x.parentId !== c.id));
            if (post && gone > 0) {
              const next = { ...post, commentCount: Math.max(0, post.commentCount - gone) };
              setPost(next);
              emit({ type: 'post', post: next });
            }
          } catch (e) {
            showAlert(t.socErrTitle, errorText(e, t));
          }
        },
      },
    ]);
  };

  const confirmBlockComment = (c) => {
    // Comentario anónimo: bloquear oculta solo ese comentario.
    const anon = !c.author?.publicId;
    showAlert(t.socBlockTitle, anon ? t.socBlockAnonBody : t.socBlockBody, [
      { text: t.socCancel, style: 'cancel' },
      {
        text: t.socBlockConfirm, style: 'destructive',
        onPress: async () => {
          try {
            await blockCommentAuthor(sessionToken, c.id);
            emit({ type: 'blocked' });
            showToast(anon ? t.socBlockAnonDone : t.socBlockDone);
            loadComments();
          } catch (e) {
            showAlert(t.socErrTitle, errorText(e, t));
          }
        },
      },
    ]);
  };

  const commentOptions = [];
  if (menuComment) {
    const c = menuComment;
    if (c.isOwn) {
      commentOptions.push({ key: 'delete', label: t.socDelete, destructive: true, onPress: () => confirmDeleteComment(c) });
    } else {
      if (c.author?.publicId) {
        commentOptions.push({ key: 'profile', label: t.socViewProfile, onPress: () => navigation.navigate('UserProfile', { publicId: c.author.publicId }) });
      }
      if (!isV1) {
        commentOptions.push({ key: 'report', label: t.socReportComment, onPress: () => setReportComment(c) });
        commentOptions.push({ key: 'block', label: t.socBlockAuthor, destructive: true, onPress: () => confirmBlockComment(c) });
      }
    }
  }

  const renderComment = (c, isReply) => (
    <View key={c.id} style={[styles.comment, isReply && styles.reply]}>
      <View style={styles.commentHeader}>
        <TouchableOpacity
          style={styles.commentAuthor}
          disabled={!c.author?.publicId}
          onPress={() => navigation.navigate('UserProfile', { publicId: c.author.publicId })}
        >
          <Avatar author={c.author} size={isReply ? 24 : 28} />
          <Text style={styles.commentName} numberOfLines={1}>{c.author?.displayName ?? t.socAnonymous}</Text>
          <Text style={styles.commentTime}>{timeAgo(c.createdAt, t, lang)}</Text>
        </TouchableOpacity>
        {(c.isOwn || commentMenuAvailable(c, isV1)) ? <MoreButton onPress={() => setMenuComment(c)} label={t.socOptions} /> : null}
      </View>
      <Text style={styles.commentBody}>{c.body}</Text>
      {c.isOwn && c.status === 'pending' ? (
        <View style={styles.pendingRow}>
          <View style={styles.pending}><Text style={styles.pendingText}>{t.socBadgeReview}</Text></View>
          <Text style={styles.pendingExplain}>{t.socCommentHeldExplain}</Text>
        </View>
      ) : null}
      {c.status === 'published' && !isV1 ? (
        <View style={styles.commentActions}>
          <TouchableOpacity style={styles.like} onPress={() => toggleLike(c)} accessibilityLabel={t.socLike} accessibilityState={{ selected: c.likedByMe }}>
            <Svg width="14" height="14" viewBox="0 0 16 16" fill={c.likedByMe ? COLORS.upbRed : 'none'}>
              <Path d="M8 14s-5-3-5-7a3 3 0 015-2 3 3 0 015 2c0 4-5 7-5 7z" stroke={c.likedByMe ? COLORS.upbRed : COLORS.inkMuted} strokeWidth="1.5" />
            </Svg>
            {c.likes > 0 ? <Text style={styles.likeCount}>{c.likes}</Text> : null}
          </TouchableOpacity>
          {!isReply && canComment ? (
            <TouchableOpacity onPress={() => setReplyTo({ id: c.id, name: c.author?.displayName ?? t.socAnonymous })}>
              <Text style={styles.replyBtn}>{t.socReply}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  if (!post) {
    return (
      <View style={styles.container}>
        <TopBar title={t.socPostTitle} onBack={() => navigation.goBack()} />
        <StateView
          loading={!postError}
          error={postError ? (postError.code === 'not_found' ? t.socPostNotFound : errorText(postError, t)) : null}
          onRetry={postError?.code === 'not_found' ? undefined : loadPost}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar title={t.socPostTitle} onBack={() => navigation.goBack()} />
      <KeyboardScreen>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
        >
          <PostCard
            post={post}
            full
            v1={actions.v1}
            onAuthorPress={actions.onAuthorPress}
            onReact={actions.onReact}
            onToggleSave={actions.onToggleSave}
            onMenu={actions.onMenu}
            onSos={actions.onSos}
          />

          <Text style={styles.sectionTitle}>{t.socCommentsTitle}</Text>
          {loadingComments || commentsError || threads.length === 0 ? (
            <StateView
              loading={loadingComments}
              error={commentsError ? t.socCommentsError : null}
              empty={canComment ? t.socNoComments : t.socCommentOnPending}
              onRetry={loadComments}
            />
          ) : (
            threads.map(c => (
              <View key={c.id} style={{ gap: 8 }}>
                {renderComment(c, false)}
                {c.replies.map(r => renderComment(r, true))}
              </View>
            ))
          )}
        </ScrollView>

        {canComment ? (
          <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
            {replyTo ? (
              <View style={styles.replyBanner}>
                <Text style={styles.replyBannerText} numberOfLines={1}>{fmt(t.socReplyingTo, { name: replyTo.name })}</Text>
                <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={10} accessibilityLabel={t.socCancel}>
                  <Svg width="12" height="12" viewBox="0 0 16 16"><Path d="M2 2l12 12M14 2L2 14" stroke={COLORS.inkSoft} strokeWidth="2.2" strokeLinecap="round" /></Svg>
                </TouchableOpacity>
              </View>
            ) : null}
            <IdentityPicker
              compact
              anonymous={anonymous || !alias}
              onChange={setAnonymous}
              alias={alias}
              avatar={me}
              onSetAlias={() => navigation.navigate('EditProfile')}
            />
            <View style={styles.inputRow}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t.socCommentPlaceholder}
                placeholderTextColor={COLORS.inkMuted}
                style={styles.input}
                multiline
                maxLength={LIMITS.commentBody}
                editable={!sending}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() || sending) && styles.disabled]}
                disabled={!text.trim() || sending}
                onPress={send}
                accessibilityLabel={t.socSend}
              >
                {sending ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Svg width="16" height="16" viewBox="0 0 16 16"><Path d="M2 8l11-5-4 11-2-4.5L2 8z" fill="#fff" /></Svg>
                )}
              </TouchableOpacity>
            </View>
            {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
          </View>
        ) : null}
      </KeyboardScreen>

      {actions.elements}
      <OptionSheet visible={!!menuComment} onClose={() => setMenuComment(null)} options={commentOptions} cancelLabel={t.socCancel} />
      <ReportSheet
        visible={!!reportComment_}
        title={t.socReportComment}
        onClose={() => setReportComment(null)}
        onSubmit={(reason, detail) => reportComment(sessionToken, reportComment_.id, reason, detail)}
        onSeeSupport={() => navigation.navigate('Sos')}
      />
      <ModerationModal
        result={result}
        kind="comment"
        onClose={() => setResult(null)}
        onSos={() => { setResult(null); navigation.navigate('Sos'); }}
      />
    </View>
  );
}

function commentMenuAvailable(c, isV1) {
  return !!c.author?.publicId || !isV1;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  sectionTitle: { fontFamily: FONTS.extraBold, fontSize: 15, color: COLORS.ink, marginTop: 8 },
  comment: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 12, gap: 6, ...SHADOW, shadowOpacity: 0.04, elevation: 1 },
  reply: { marginLeft: 28, backgroundColor: '#FBFAFE' },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentAuthor: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentName: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.ink, flexShrink: 1 },
  commentTime: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted },
  commentBody: { fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink, lineHeight: 20 },
  pendingRow: { gap: 4 },
  pending: { alignSelf: 'flex-start', backgroundColor: COLORS.tones.sun.bg, borderRadius: RADIUS.pill, paddingVertical: 2, paddingHorizontal: 8 },
  pendingText: { fontFamily: FONTS.uiBold, fontSize: 10, color: COLORS.tones.sun.ink },
  pendingExplain: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkSoft },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  like: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  likeCount: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.inkSoft },
  replyBtn: { fontFamily: FONTS.uiBold, fontSize: 12, color: COLORS.primary, paddingVertical: 4 },
  composer: {
    backgroundColor: COLORS.bgCard, paddingHorizontal: 12, paddingTop: 10, gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.hair,
  },
  replyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.sm, paddingVertical: 6, paddingHorizontal: 10,
  },
  replyBannerText: { flex: 1, fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.primaryDeep },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1, maxHeight: 120, minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(26,21,35,0.12)',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontFamily: FONTS.uiRegular, fontSize: 14, color: COLORS.ink,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  error: { fontFamily: FONTS.uiRegular, fontSize: 12, color: '#D93B4A' },
});
