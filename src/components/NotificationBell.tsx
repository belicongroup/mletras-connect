import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout } from '../theme';

interface NotificationBellProps {
  unreadCount: number;
  onPress: () => void;
}

function NotificationBellComponent({ unreadCount, onPress }: NotificationBellProps) {
  const hasUnread = unreadCount > 0;
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        hasUnread ? `Notifications, ${unreadCount} unread` : 'Notifications'
      }
      onPress={onPress}
      hitSlop={8}
      style={styles.container}
    >
      <Ionicons name="notifications-outline" size={24} color={colors.text} />
      {hasUnread ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {badgeLabel}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export const NotificationBell = memo(NotificationBellComponent);

const styles = StyleSheet.create({
  container: {
    width: layout.avatarSm,
    height: layout.avatarSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.like,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
});
