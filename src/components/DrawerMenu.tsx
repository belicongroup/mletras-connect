import React, { memo, useMemo } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { colors, spacing, typography } from '../theme';
import { UserProfile } from '../types';
import { getDisplayName } from '../utils/format';

interface DrawerMenuProps {
  visible: boolean;
  user: UserProfile;
  slideAnim: Animated.Value;
  onClose: () => void;
  onEditProfile: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}

function DrawerMenuComponent({
  visible,
  user,
  slideAnim,
  onClose,
  onEditProfile,
  onProfile,
  onSettings,
  onSignOut,
}: DrawerMenuProps) {
  const insets = useSafeAreaInsets();
  const { strings } = useAuthLanguage();

  const menuItems = useMemo(
    () =>
      [
        { key: 'edit' as const, label: strings.editProfile },
        { key: 'profile' as const, label: strings.profile },
        { key: 'settings' as const, label: strings.settings },
        { key: 'signout' as const, label: strings.signOut },
      ] as const,
    [strings],
  );

  const handlers = {
    edit: onEditProfile,
    profile: onProfile,
    settings: onSettings,
    signout: onSignOut,
  };

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <Animated.View
          style={[
            styles.drawer,
            { paddingTop: insets.top + spacing.lg, transform: [{ translateX: slideAnim }] },
          ]}
        >
          <View style={styles.profile}>
            <Avatar user={user} size={48} />
            <Text style={styles.name}>{getDisplayName(user)}</Text>
            <Text style={styles.username}>@{user.username}</Text>
          </View>

          {menuItems.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                handlers[item.key]();
              }}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <Text
                style={[styles.itemText, item.key === 'signout' && styles.signOutText]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
}

export const DrawerMenu = memo(DrawerMenuComponent);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: colors.drawer,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  profile: {
    marginBottom: spacing.xxl,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
    marginTop: spacing.md,
  },
  username: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  item: {
    paddingVertical: spacing.md,
  },
  itemText: {
    ...typography.body,
    color: colors.text,
  },
  signOutText: {
    color: colors.danger,
  },
  pressed: {
    opacity: 0.7,
  },
});
