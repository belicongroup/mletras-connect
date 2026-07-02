import React, { memo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, layout } from '../theme';
import { getInitials } from '../utils/format';

interface AvatarProps {
  user: { firstName?: string; lastName?: string; username: string };
  size?: number;
  style?: ViewStyle;
}

function AvatarComponent({ user, size = layout.avatarSm, style }: AvatarProps) {
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{getInitials(user)}</Text>
    </View>
  );
}

export const Avatar = memo(AvatarComponent);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.text,
    fontWeight: '700',
  },
});
