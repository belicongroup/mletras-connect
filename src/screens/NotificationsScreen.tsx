import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { useApp } from '../context/AppContext';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { getNotifications, markRead } from '../services/notificationsService';
import { AppNotification, RootStackParamList } from '../types';
import { colors, layout, spacing, typography } from '../theme';
import { formatRelativeTime } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { strings } = useAuthLanguage();
  const { markAllNotificationsRead, refreshUnreadCount } = useApp();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const page = await getNotifications(null);
      if (!mounted) return;
      setNotifications(page.notifications);
      setCursor(page.nextCursor);
      setHasMore(page.nextCursor !== null);
      setLoading(false);
      void markAllNotificationsRead();
    })();
    return () => {
      mounted = false;
      void refreshUnreadCount();
    };
  }, [markAllNotificationsRead, refreshUnreadCount]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    const page = await getNotifications(cursor);
    setNotifications((prev) => {
      const seen = new Set(prev.map((n) => n.id));
      return [...prev, ...page.notifications.filter((n) => !seen.has(n.id))];
    });
    setCursor(page.nextCursor);
    setHasMore(page.nextCursor !== null);
  }, [cursor]);

  const handlePress = useCallback(
    (item: AppNotification) => {
      if (!item.read) void markRead(item.id);
      if (item.postId) navigation.navigate('CommentThread', { postId: item.postId });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => {
      const phrase =
        item.type === 'comment_on_post'
          ? strings.commentedOnYourPost
          : strings.repliedInThread;

      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => handlePress(item)}
          style={({ pressed }) => [
            styles.row,
            !item.read && styles.unreadRow,
            pressed && styles.pressed,
          ]}
        >
          <Avatar user={item.actor} size={40} />
          <View style={styles.body}>
            <Text style={styles.message}>
              <Text style={styles.actor}>@{item.actor.username}</Text>{' '}
              {phrase}
              {'  '}
              <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
            </Text>
            {item.postPreview ? (
              <Text style={styles.preview} numberOfLines={1}>
                {item.postPreview}
              </Text>
            ) : null}
          </View>
          {!item.read ? <View style={styles.dot} /> : null}
        </Pressable>
      );
    },
    [handlePress, strings.commentedOnYourPost, strings.repliedInThread],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{strings.notifications}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onEndReached={hasMore ? loadMore : undefined}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>{strings.noNotificationsYet}</Text>
            </View>
          }
          contentContainerStyle={notifications.length === 0 ? styles.emptyList : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: layout.avatarSm,
    height: layout.avatarSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.heading,
    color: colors.text,
  },
  loading: {
    padding: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  unreadRow: {
    backgroundColor: colors.drawer,
  },
  pressed: {
    opacity: 0.7,
  },
  body: {
    flex: 1,
  },
  message: {
    ...typography.caption,
    color: colors.text,
  },
  actor: {
    ...typography.bodyBold,
    color: colors.text,
  },
  time: {
    ...typography.small,
    color: colors.textSecondary,
  },
  preview: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
