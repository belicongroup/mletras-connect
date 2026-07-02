import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { FeedPost } from '../components/FeedPost';
import { useApp } from '../context/AppContext';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { buildProfileSummary } from '../services/profileService';
import { Post, RootStackParamList } from '../types';
import { colors, layout, spacing, typography } from '../theme';
import { getDisplayName, getLocation } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const { currentUser, posts, toggleLike } = useApp();
  const { strings } = useAuthLanguage();

  const userPosts = useMemo(
    () => (currentUser ? posts.filter((p) => p.authorId === currentUser.id) : []),
    [currentUser, posts],
  );

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
            <FeedPost post={item} author={currentUser} onLike={toggleLike} />
          )}
          ListEmptyComponent={<Text style={styles.empty}>{strings.noPostsYet}</Text>}
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
});
