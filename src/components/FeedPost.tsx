import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { ConfirmDialog } from './ConfirmDialog';
import { LinkedPostText } from './LinkedPostText';
import { MediaCarousel } from './MediaCarousel';
import { PostVideo } from './PostVideo';
import { SocialLinkEmbed } from './SocialLinkEmbed';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { colors, spacing, typography } from '../theme';
import { Post, PostMedia, UserProfile } from '../types';
import { formatCount, formatRelativeTime, getLocation } from '../utils/format';
import { extractSocialLinks } from '../utils/socialLinks';

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
  const { strings } = useAuthLanguage();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const handleLike = useCallback(() => onLike(post.id), [onLike, post.id]);
  const handleComment = useCallback(() => onComment?.(post.id), [onComment, post.id]);
  const isOwner = currentUserId === post.authorId;

  const handleDelete = useCallback(() => {
    setDeleteOpen(false);
    onDelete?.(post.id);
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
  const socialLink = useMemo(() => {
    if (video) return null;
    return extractSocialLinks(post.text)[0] ?? null;
  }, [post.text, video]);

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
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Post options"
                  onPress={() => setDeleteOpen(true)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.menuTrigger, pressed && styles.pressed]}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                </Pressable>
                <ConfirmDialog
                  visible={deleteOpen}
                  title={strings.deletePostConfirm}
                  confirmLabel={strings.deletePost}
                  cancelLabel={strings.cancel}
                  destructive
                  onConfirm={handleDelete}
                  onCancel={() => setDeleteOpen(false)}
                />
              </>
            ) : null}
          </View>
          <Text style={styles.location}>{getLocation(author.city, author.state)}</Text>
          {post.text ? <LinkedPostText text={post.text} style={styles.text} /> : null}
          {socialLink ? <SocialLinkEmbed link={socialLink} /> : null}

          {video ? (
            <PostVideo
              key={`${post.id}-${video.processingStatus}`}
              media={video}
              isActive={isVideoActive}
            />
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
  menuTrigger: {
    padding: spacing.xs,
    marginLeft: 'auto',
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
