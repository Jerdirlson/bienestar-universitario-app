import React, { memo } from 'react';
import { View, TouchableOpacity, Pressable, StyleSheet, Platform } from 'react-native';
import Avatar from './Avatar';
import MoodFace from '../MoodFace';
import { MoreButton } from './ui';
import Text from '../../ui/Text';
import Icon from '../../ui/Icon';
import { haptics } from '../../ui';
import { useApp } from '../../context/AppContext';
import { REACTION_KINDS } from '../../data/socialCore';
import { COLORS, RADIUS, SPACING } from '../../theme';
import { REACTION_EMOJI, timeAgo } from './format';

/**
 * Tarjeta de publicación, reutilizable en el feed, el detalle, perfiles y
 * listas propias. No hace llamadas: todo sale por callbacks. Jerarquía (§1 y
 * la especificación de esta tarea): autor/avatar arriba, tiempo en
 * `footnote`, cuerpo en `body`, acciones abajo con iconos de Ionicons y
 * conteos.
 *
 * Anonimato: con `post.author` null no hay nada que tocar ni mostrar del
 * autor; el nombre es "Anónimo" y el avatar es la silueta común.
 *
 * H14 de la auditoría: lo propio en revisión u oculto/no publicado se
 * distingue con un borde y fondo de estado (no solo una etiqueta pequeña),
 * además de la explicación que ya traía.
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

  const held = post.isOwn && post.status === 'pending';
  // Rechazada o quitada por un moderador: solo la ve su autor.
  const rejected = post.isOwn && (post.status === 'rejected' || post.status === 'removed');
  // H14: tarjeta con borde/fondo de estado, no solo una etiqueta pequeña.
  const stateTone = rejected ? COLORS.destructive : (held ? COLORS.tones.sun.ink : null);

  const react = (kind) => {
    haptics.impactLight();
    onReact?.(post, kind);
  };
  const toggleSave = () => {
    haptics.impactLight();
    onToggleSave?.(post);
  };

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
          <Text variant="headline" numberOfLines={1}>{author?.displayName ?? t.socAnonymous}</Text>
          <Text variant="footnote" color={COLORS.tertiaryLabel} numberOfLines={1}>
            {timeAgo(post.createdAt, t, lang)}
            {post.editedAt ? ` · ${t.socEdited}` : ''}
          </Text>
        </View>
      </TouchableOpacity>
      {post.mood !== null ? <MoodFace level={post.mood} size={26} /> : null}
      {onMenu ? <MoreButton onPress={() => onMenu(post)} label={t.socOptions} /> : null}
    </View>
  );

  return (
    <View style={[styles.card, stateTone && { borderColor: stateTone, borderWidth: 1.5, backgroundColor: rejected ? '#FDEEEE' : COLORS.tones.sun.bg }]}>
      {Header}

      {(post.topic || held || rejected) ? (
        <View style={styles.tags}>
          {post.topic ? (
            <View style={styles.topic}><Text variant="caption1" color={COLORS.primaryDeep}>{t.socTopics[post.topic]}</Text></View>
          ) : null}
          {held ? (
            <View style={[styles.pending, { backgroundColor: COLORS.tones.sun.ink }]}>
              <Text variant="caption1" color="#fff">{post.heldReason === 'reports' ? t.socBadgeHidden : t.socBadgeReview}</Text>
            </View>
          ) : null}
          {rejected ? (
            <View style={[styles.pending, { backgroundColor: COLORS.destructive }]}>
              <Text variant="caption1" color="#fff">{t.socBadgeNotPublished}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <TouchableOpacity activeOpacity={onOpen ? 0.7 : 1} disabled={!onOpen} onPress={() => onOpen(post)}>
        <Text variant="body" numberOfLines={full ? undefined : 8}>{post.body}</Text>
      </TouchableOpacity>

      {rejected ? (
        <View style={styles.explain}>
          <Text variant="footnote" color={COLORS.destructive} style={styles.explainText}>{t.socNotPublishedExplain}</Text>
        </View>
      ) : null}

      {held ? (
        <View style={styles.explain}>
          <Text variant="footnote" color={COLORS.tones.sun.ink} style={styles.explainText}>
            {post.heldReason === 'crisis' ? t.socHeldCrisisExplain
              : post.heldReason === 'reports' ? t.socHeldReportsExplain
                : t.socHeldReviewExplain}
          </Text>
          {post.heldReason === 'crisis' && onSos ? (
            <TouchableOpacity style={styles.sosLink} onPress={onSos} accessibilityRole="button">
              <Text variant="footnote" color="#fff">{t.socSeeSupport}</Text>
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
                <Pressable
                  key={k}
                  style={[styles.reaction, mine && styles.reactionMine]}
                  onPress={() => react(mine ? null : k)}
                  disabled={!onReact}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mine }}
                  accessibilityLabel={`${t.socReactions[k]} ${n}`}
                >
                  <Text style={styles.reactionEmoji} allowFontScaling={false}>{REACTION_EMOJI[k]}</Text>
                  {n > 0 ? <Text variant="caption1" color={mine ? COLORS.primaryDeep : COLORS.secondaryLabel}>{n}</Text> : null}
                </Pressable>
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
            <Icon name="chatbubble-outline" size={18} color={COLORS.secondaryLabel} />
            <Text variant="caption1" color={COLORS.secondaryLabel}>{post.commentCount}</Text>
          </TouchableOpacity>
          {onToggleSave ? (
            <TouchableOpacity
              style={styles.iconAction}
              onPress={toggleSave}
              accessibilityLabel={post.savedByMe ? t.socUnsavePost : t.socSavePost}
              accessibilityState={{ selected: post.savedByMe }}
            >
              <Icon name={post.savedByMe ? 'bookmark' : 'bookmark-outline'} size={18} color={post.savedByMe ? COLORS.accent : COLORS.secondaryLabel} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default memo(PostCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.sm,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  authorTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  topic: { backgroundColor: COLORS.accentTint, borderRadius: RADIUS.pill, paddingVertical: 3, paddingHorizontal: SPACING.sm },
  pending: { borderRadius: RADIUS.pill, paddingVertical: 3, paddingHorizontal: SPACING.sm },
  explain: { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: RADIUS.sm, padding: SPACING.sm, gap: SPACING.sm },
  explainText: { lineHeight: 17 },
  sosLink: { alignSelf: 'flex-start', backgroundColor: COLORS.sos, borderRadius: RADIUS.pill, paddingVertical: 7, paddingHorizontal: SPACING.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  reactions: { flexDirection: 'row', gap: SPACING.xs, flexShrink: 1, flexWrap: 'wrap' },
  reaction: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill,
    paddingVertical: 5, paddingHorizontal: 9, backgroundColor: COLORS.fill, minHeight: 32,
  },
  reactionMine: { backgroundColor: COLORS.accentTint, borderWidth: 1, borderColor: COLORS.accent, paddingVertical: 4, paddingHorizontal: 8 },
  reactionEmoji: { fontSize: 15 },
  iconAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 6 },
});
