import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { MediaCarousel } from './MediaCarousel';
import { OptionsMenu } from './OptionsMenu';
import { PostVideo } from './PostVideo';
import { colors, spacing, typography } from '../theme';
import { Post, PostMedia, UserProfile } from '../types';
import { formatCount, formatRelativeTime, getLocation } from '../utils/format';
import { confirmAction } from '../utils/alert';

interface FeedPostProps {
  post: Post;
  author: UserProfile;
  currentUserId?: string;
  /** True when this post's video is scrolled into view (drives autoplay). */
  isVideoActive?: boolean;
  onLike: (postId: string) => void;
  onComment?: (postId: string) => void;
  onDelete?: (postId: string) => void;
}

function FeedPostComponent({
  post,
  author,
  currentUserId,
  isVideoActive,
  onLike,
  onComment,
  onDelete,
}: FeedPostProps) {
  const handleLike = useCallback(() => onLike(post.id), [onLike, post.id]);
  const handleComment = useCallback(() => onComment?.(post.id), [onComment, post.id]);
  const isOwner = currentUserId === post.authorId;

  const handleDelete = useCallback(async () => {
    const confirmed = await confirmAction(
      'Delete post?',
      'This permanently removes the post, comments, and media. This cannot be undone.',
    );
    if (confirmed) onDelete?.(post.id);
  }, [onDelete, post.id]);

  // Prefer the responsive media array; fall back to the legacy single image.
  const media: PostMedia[] = useMemo(() => {
    if (post.media && post.media.length > 0) return post.media;
    if (post.imageUrl) {
      return [{ type: 'image', url: post.imageUrl, processingStatus: 'ready' }];
    }
    return [];
  }, [post.media, post.imageUrl]);

  const video = media.find((m) => m.type === 'video');
  const images = media.filter((m) => m.type === 'image');

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Avatar user={author} size={40} />
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.header}>
              <Text style={styles.username}>@{author.username}</Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.meta}>{formatRelativeTime(post.createdAt)}</Text>
            </View>
            {isOwner && onDelete ? (
              <OptionsMenu
                accessibilityLabel="Post options"
                options={[{ label: 'Delete post', destructive: true, onPress: handleDelete }]}
              />
            ) : null}
          </View>
          <Text style={styles.location}>{getLocation(author.city, author.state)}</Text>
          <Text style={styles.text}>{post.text}</Text>

          {video ? (
            <PostVideo media={video} isActive={isVideoActive} />
          ) : images.length > 0 ? (
            <MediaCarousel media={images} />
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={handleLike}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Ionicons
                name={post.isLiked ? 'heart' : 'heart-outline'}
                size={18}
                color={post.isLiked ? colors.like : colors.textSecondary}
              />
              {post.likesCount > 0 ? (
                <Text style={[styles.actionText, post.isLiked && styles.likedText]}>
                  {formatCount(post.likesCount)}
                </Text>
              ) : null}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={handleComment}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
              {post.commentsCount > 0 ? (
                <Text style={styles.actionText}>{formatCount(post.commentsCount)}</Text>
              ) : null}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export const FeedPost = memo(FeedPostComponent);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  header: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  username: {
    ...typography.bodyBold,
    color: colors.text,
  },
  dot: {
    color: colors.textSecondary,
    marginHorizontal: 4,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  location: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  text: {
    ...typography.body,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xxl,
    marginTop: spacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
  },
  actionText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  likedText: {
    color: colors.like,
  },
  pressed: {
    opacity: 0.7,
  },
});
