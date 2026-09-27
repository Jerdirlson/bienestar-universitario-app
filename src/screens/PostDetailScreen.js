import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardScreen from '../components/KeyboardScreen';
import Header from '../components/social/Header';
import PostCard from '../components/social/PostCard';
import Avatar from '../components/social/Avatar';
import IdentityPicker from '../components/social/IdentityPicker';
import ModerationModal from '../components/social/ModerationModal';
import ReportSheet from '../components/social/ReportSheet';
import { OptionSheet } from '../components/social/Sheet';
import { StateView, MoreButton } from '../components/social/ui';
import Text from '../ui/Text';
import Icon from '../ui/Icon';
import { TextArea } from '../ui/TextField';
import { usePostActions } from '../components/social/hooks';
import { errorText, fmt, timeAgo } from '../components/social/format';
import { useApp } from '../context/AppContext';
import { useSocial } from '../context/SocialContext';
import {
  getPost, listComments, createComment, deleteComment, likeComment, unlikeComment,
  reportComment, blockCommentAuthor, appealComment,
} from '../data/community';
import { normalizePost, threadComments, applyCommentLike, canAppeal, LIMITS } from '../data/socialCore';
import { COLORS, RADIUS, SPACING } from '../theme';
import { showAlert } from '../components/dialogs';

/**
 * Detalle de una publicación con sus comentarios (respuestas de un nivel),
 * bien anidados: la respuesta va indentada y con fondo ligeramente distinto
 * bajo su comentario padre. Acepta { post } (ya cargado, se muestra al
 * instante) o { postId } (desde una notificación): en ambos casos se vuelve a
 * pedir por id.
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

  /** "Pedir revisión" sobre un comentario propio rechazado — moderación v2, una sola vez. */
  const onAppealComment = async (c) => {
    try {
      const updated = await appealComment(sessionToken, c.id);
      setComments(prev => prev.map(x => (x.id === c.id ? updated : x)));
      showToast(t.socRequestReviewSent);
    } catch (e) {
      showToast(errorText(e, t));
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
          <Text variant="subhead" numberOfLines={1} style={styles.commentName}>{c.author?.displayName ?? t.socAnonymous}</Text>
          <Text variant="caption1" color={COLORS.tertiaryLabel}>{timeAgo(c.createdAt, t, lang)}</Text>
        </TouchableOpacity>
        {(c.isOwn || commentMenuAvailable(c, isV1)) ? <MoreButton onPress={() => setMenuComment(c)} label={t.socOptions} /> : null}
      </View>
      <Text variant="body" style={styles.commentBody}>{c.body}</Text>
      {c.isOwn && c.status === 'pending' ? (
        <View style={styles.pendingRow}>
          <View style={styles.pending}><Text variant="caption2" color={COLORS.tones.sun.ink}>{t.socBadgeReview}</Text></View>
          <Text variant="caption1" color={COLORS.secondaryLabel}>{t.socCommentHeldExplain}</Text>
        </View>
      ) : null}
      {c.isOwn && c.status === 'rejected' ? (
        <View style={styles.pendingRow}>
          <View style={[styles.pending, { backgroundColor: COLORS.destructive }]}>
            <Text variant="caption2" color="#fff">{t.socBadgeNotPublished}</Text>
          </View>
          <Text variant="caption1" color={COLORS.destructive}>{t.socNotPublishedExplain}</Text>
          {canAppeal(c) ? (
            <TouchableOpacity onPress={() => onAppealComment(c)} accessibilityRole="button">
              <Text variant="caption1" color={COLORS.accent} style={{ fontWeight: '600' }}>{t.socRequestReview}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {c.status === 'published' && !isV1 ? (
        <View style={styles.commentActions}>
          <TouchableOpacity style={styles.like} onPress={() => toggleLike(c)} accessibilityLabel={t.socLike} accessibilityState={{ selected: c.likedByMe }}>
            <Icon name={c.likedByMe ? 'heart' : 'heart-outline'} size={16} color={c.likedByMe ? COLORS.destructive : COLORS.tertiaryLabel} />
            {c.likes > 0 ? <Text variant="caption1" color={COLORS.secondaryLabel}>{c.likes}</Text> : null}
          </TouchableOpacity>
          {!isReply && canComment ? (
            <TouchableOpacity onPress={() => setReplyTo({ id: c.id, name: c.author?.displayName ?? t.socAnonymous })}>
              <Text variant="caption1" color={COLORS.accent} style={styles.replyBtn}>{t.socReply}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  if (!post) {
    return (
      <View style={styles.container}>
        <Header title={t.socPostTitle} onBack={() => navigation.goBack()} />
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
      <Header title={t.socPostTitle} onBack={() => navigation.goBack()} />
      <KeyboardScreen>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />}
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
            onAppeal={actions.onAppeal}
          />

          <Text variant="title3" style={styles.sectionTitle}>{t.socCommentsTitle}</Text>
          {loadingComments || commentsError || threads.length === 0 ? (
            <StateView
              loading={loadingComments}
              error={commentsError ? t.socCommentsError : null}
              empty={canComment ? t.socNoComments : t.socCommentOnPending}
              onRetry={loadComments}
            />
          ) : (
            threads.map(c => (
              <View key={c.id} style={{ gap: SPACING.sm }}>
                {renderComment(c, false)}
                {c.replies.map(r => renderComment(r, true))}
              </View>
            ))
          )}
        </ScrollView>

        {canComment ? (
          <View style={[styles.composer, { paddingBottom: insets.bottom + SPACING.sm }]}>
            {replyTo ? (
              <View style={styles.replyBanner}>
                <Text variant="footnote" color={COLORS.primaryDeep} numberOfLines={1} style={{ flex: 1 }}>{fmt(t.socReplyingTo, { name: replyTo.name })}</Text>
                <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={10} accessibilityLabel={t.socCancel}>
                  <Icon name="close" size={14} color={COLORS.secondaryLabel} />
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
              <TextArea
                value={text}
                onChangeText={setText}
                placeholder={t.socCommentPlaceholder}
                style={styles.input}
                minHeight={42}
                maxLength={LIMITS.commentBody}
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
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  sectionTitle: { marginTop: SPACING.xs },
  comment: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.xs,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  reply: { marginLeft: SPACING.xxl, backgroundColor: COLORS.fill },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  commentAuthor: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  commentName: { flexShrink: 1 },
  commentBody: { lineHeight: 20 },
  pendingRow: { gap: 4 },
  pending: { alignSelf: 'flex-start', backgroundColor: COLORS.tones.sun.bg, borderRadius: RADIUS.pill, paddingVertical: 2, paddingHorizontal: SPACING.sm },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  like: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  replyBtn: { paddingVertical: 4 },
  composer: {
    backgroundColor: COLORS.bgElevated, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.separator,
  },
  replyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm,
    backgroundColor: COLORS.accentTint, borderRadius: RADIUS.sm, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm },
  input: { flex: 1, maxHeight: 120, borderRadius: 21 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
});
