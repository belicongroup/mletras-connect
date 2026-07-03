import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { FeedPost } from '../components/FeedPost';
import { useApp } from '../context/AppContext';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { buildProfileSummary } from '../services/profileService';
import { getMyPosts, likePost, unlikePost } from '../services/postsService';
import { Post, RootStackParamList } from '../types';
import { colors, layout, spacing, typography } from '../theme';
import { getDisplayName, getLocation } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useApp();
  const { strings } = useAuthLanguage();

  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const page = await getMyPosts(null);
      if (!mounted) return;
      setUserPosts(page.posts);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleLike = useCallback((postId: string) => {
    setUserPosts((prev) => {
      const target = prev.find((p) => p.id === postId);
      if (!target) return prev;
      const nextLiked = !target.isLiked;
      const action = nextLiked ? likePost : unlikePost;
      action(postId).then((result) => {
        if (!result) return;
        setUserPosts((cur) =>
          cur.map((p) =>
            p.id === postId
              ? { ...p, isLiked: result.isLiked, likesCount: result.likesCount }
              : p,
          ),
        );
      });
      return prev.map((p) =>
        p.id === postId
          ? { ...p, isLiked: nextLiked, likesCount: p.likesCount + (nextLiked ? 1 : -1) }
          : p,
      );
    });
  }, []);

  if (!currentUser) return null;

  const summary = buildProfileSummary(currentUser);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{strings.profile}</Text>
      </View>

      <View style={[styles.content, { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }]}>
        <View style={styles.profile}>
          <Avatar user={currentUser} size={72} />
          <Text style={styles.name}>{getDisplayName(currentUser)}</Text>
          <Text style={styles.username}>@{currentUser.username}</Text>
          <Text style={styles.location}>{getLocation(currentUser.city, currentUser.state)}</Text>
          <Text style={styles.instruments}>{summary.instruments}</Text>
          <Text style={styles.memberSince}>
            {strings.memberSince} {summary.memberSince}
          </Text>
        </View>

        <FlatList
          data={userPosts}
          keyExtractor={(item: Post) => item.id}
          renderItem={({ item }) => (
            <FeedPost post={item} author={currentUser} onLike={handleToggleLike} />
          )}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loading} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>{strings.noPostsYet}</Text>
            )
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
  },
  content: { flex: 1 },
  profile: {
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.md,
  },
  username: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  location: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  instruments: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.md,
  },
  memberSince: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  empty: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.xxl,
  },
  loading: {
    padding: spacing.xxl,
  },
});
