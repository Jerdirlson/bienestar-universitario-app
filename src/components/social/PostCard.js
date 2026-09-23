import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Avatar from './Avatar';
import MoodFace from '../MoodFace';
import { MoreButton } from './ui';
import { useApp } from '../../context/AppContext';
import { REACTION_KINDS } from '../../data/socialCore';
import { COLORS, FONTS, RADIUS, SHADOW } from '../../theme';
import { REACTION_EMOJI, timeAgo } from './format';

/**
 * Tarjeta de publicación, reutilizable en el feed, el detalle, perfiles y
 * listas propias. No hace llamadas: todo sale por callbacks.
 *
 * Anonimato: con `post.author` null no hay nada que tocar ni mostrar del
 * autor; el nombre es "Anónimo" y el avatar es la silueta común.
 */
function PostCard({
  post, full = false, v1 = false,
  onOpen, onAuthorPress, onReact, onToggleSave, onMenu, onSos,
}) {
  const { t, lang } = useApp();
  const author = post.author;
  const canOpenAuthor = !!(author?.publicId && onAuthorPress);
  const published = post.status === 'published';
  const kinds = v1 ? ['abrazo'] : REACTION_KINDS;

  const Header = (
    <View style={styles.header}>
      <TouchableOpacity
        disabled={!canOpenAuthor}
        onPress={() => onAuthorPress(author.publicId)}
        style={styles.authorTap}
        accessibilityRole={canOpenAuthor ? 'link' : undefined}
      >
        <Avatar author={author} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{author?.displayName ?? t.socAnonymous}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {timeAgo(post.createdAt, t, lang)}
            {post.editedAt ? ` · ${t.socEdited}` : ''}
          </Text>
        </View>
      </TouchableOpacity>
      {post.mood !== null ? <MoodFace level={post.mood} size={26} /> : null}
      {onMenu ? <MoreButton onPress={() => onMenu(post)} label={t.socOptions} /> : null}
    </View>
  );

  const held = post.isOwn && post.status === 'pending';
  const rejected = post.isOwn && post.status === 'rejected';

  return (
    <View style={styles.card}>
      {Header}

      {(post.topic || held || rejected) ? (
        <View style={styles.tags}>
          {post.topic ? (
            <View style={styles.topic}><Text style={styles.topicText}>{t.socTopics[post.topic]}</Text></View>
          ) : null}
          {held ? (
            <View style={styles.pending}><Text style={styles.pendingText}>{post.heldReason === 'reports' ? t.socBadgeHidden : t.socBadgeReview}</Text></View>
          ) : null}
          {rejected ? (
            <View style={styles.pending}><Text style={styles.pendingText}>{t.socBadgeHidden}</Text></View>
          ) : null}
        </View>
      ) : null}

      <TouchableOpacity activeOpacity={onOpen ? 0.7 : 1} disabled={!onOpen} onPress={() => onOpen(post)}>
        <Text style={styles.body} numberOfLines={full ? undefined : 8}>{post.body}</Text>
      </TouchableOpacity>

      {held ? (
        <View style={styles.explain}>
          <Text style={styles.explainText}>
            {post.heldReason === 'crisis' ? t.socHeldCrisisExplain
              : post.heldReason === 'reports' ? t.socHeldReportsExplain
                : t.socHeldReviewExplain}
          </Text>
          {post.heldReason === 'crisis' && onSos ? (
            <TouchableOpacity style={styles.sosLink} onPress={onSos} accessibilityRole="button">
              <Text style={styles.sosLinkText}>{t.socSeeSupport}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {published ? (
        <View style={styles.actions}>
          <View style={styles.reactions}>
            {kinds.map(k => {
              const mine = post.myReaction === k;
              const n = post.reactionCounts[k];
              return (
                <TouchableOpacity
                  key={k}
                  style={[styles.reaction, mine && styles.reactionMine]}
                  onPress={() => onReact?.(post, mine ? null : k)}
                  disabled={!onReact}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mine }}
                  accessibilityLabel={`${t.socReactions[k]} ${n}`}
                >
                  <Text style={styles.reactionEmoji} allowFontScaling={false}>{REACTION_EMOJI[k]}</Text>
                  {n > 0 ? <Text style={[styles.reactionCount, mine && styles.reactionCountMine]}>{n}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.iconAction}
            onPress={() => onOpen?.(post)}
            disabled={!onOpen}
            accessibilityLabel={t.socCommentsA11y}
          >
            <Svg width="17" height="17" viewBox="0 0 16 16" fill="none">
              <Path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H6l-3 3v-3H3a1 1 0 01-1-1V4z" stroke={COLORS.inkSoft} strokeWidth="1.5" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.count}>{post.commentCount}</Text>
          </TouchableOpacity>
          {onToggleSave ? (
            <TouchableOpacity
              style={styles.iconAction}
              onPress={() => onToggleSave(post)}
              accessibilityLabel={post.savedByMe ? t.socUnsavePost : t.socSavePost}
              accessibilityState={{ selected: post.savedByMe }}
            >
              <Svg width="15" height="17" viewBox="0 0 14 16" fill={post.savedByMe ? COLORS.primary : 'none'}>
                <Path d="M2 1.5h10v13L7 11l-5 3.5v-13z" stroke={post.savedByMe ? COLORS.primary : COLORS.inkSoft} strokeWidth="1.5" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default memo(PostCard);

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: 16, gap: 10, ...SHADOW },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.ink },
  meta: { fontFamily: FONTS.uiRegular, fontSize: 11, color: COLORS.inkMuted, marginTop: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  topic: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.pill, paddingVertical: 3, paddingHorizontal: 10 },
  topicText: { fontFamily: FONTS.uiSemiBold, fontSize: 11, color: COLORS.primaryDeep },
  pending: { backgroundColor: COLORS.tones.sun.bg, borderRadius: RADIUS.pill, paddingVertical: 3, paddingHorizontal: 10 },
  pendingText: { fontFamily: FONTS.uiBold, fontSize: 11, color: COLORS.tones.sun.ink },
  body: { fontFamily: FONTS.uiRegular, fontSize: 15, color: COLORS.ink, lineHeight: 22 },
  explain: { backgroundColor: '#FFF8E1', borderRadius: RADIUS.sm, padding: 10, gap: 8 },
  explainText: { fontFamily: FONTS.uiRegular, fontSize: 12, color: COLORS.tones.sun.ink, lineHeight: 17 },
  sosLink: { alignSelf: 'flex-start', backgroundColor: '#F37171', borderRadius: RADIUS.pill, paddingVertical: 7, paddingHorizontal: 14 },
  sosLinkText: { fontFamily: FONTS.extraBold, fontSize: 12, color: '#fff' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reactions: { flexDirection: 'row', gap: 6, flexShrink: 1, flexWrap: 'wrap' },
  reaction: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill,
    paddingVertical: 5, paddingHorizontal: 9, backgroundColor: '#F5F3FA', minHeight: 32,
  },
  reactionMine: { backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 4, paddingHorizontal: 8 },
  reactionEmoji: { fontSize: 15 },
  reactionCount: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.inkSoft },
  reactionCountMine: { color: COLORS.primaryDeep },
  iconAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 6 },
  count: { fontFamily: FONTS.uiSemiBold, fontSize: 12, color: COLORS.inkSoft },
});
