import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { NotificationBell } from '../components/NotificationBell';
import { colors, layout, spacing, typography } from '../theme';
import { UserProfile } from '../types';

interface FeedHeaderProps {
  user: UserProfile;
  unreadCount: number;
  onAvatarPress: () => void;
  onNotificationsPress: () => void;
}

function FeedHeaderComponent({
  user,
  unreadCount,
  onAvatarPress,
  onNotificationsPress,
}: FeedHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        onPress={onAvatarPress}
        hitSlop={8}
      >
        <Avatar user={user} size={layout.avatarSm} />
      </Pressable>
      <Text style={styles.title}>MLetras Connect</Text>
      <NotificationBell unreadCount={unreadCount} onPress={onNotificationsPress} />
    </View>
  );
}

export const FeedHeader = memo(FeedHeaderComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
});
