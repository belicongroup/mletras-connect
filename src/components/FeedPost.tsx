import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { colors, spacing, typography } from '../theme';
import { Post, UserProfile } from '../types';
import { formatCount, formatRelativeTime, getLocation } from '../utils/format';

interface FeedPostProps {
  post: Post;
  author: UserProfile;
  onLike: (postId: string) => void;
}

function FeedPostComponent({ post, author, onLike }: FeedPostProps) {
  const handleLike = useCallback(() => onLike(post.id), [onLike, post.id]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Avatar user={author} size={40} />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.username}>@{author.username}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.meta}>{formatRelativeTime(post.createdAt)}</Text>
          </View>
          <Text style={styles.location}>{getLocation(author.city, author.state)}</Text>
          <Text style={styles.text}>{post.text}</Text>

          {post.imageUrl ? (
            <Image
              style={styles.media}
              source={{ uri: post.imageUrl }}
              contentFit="cover"
              transition={150}
            />
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
  header: {
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
  media: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    marginTop: spacing.md,
    backgroundColor: colors.placeholder,
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
