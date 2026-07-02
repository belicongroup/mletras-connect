import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

interface MediaPlaceholderProps {
  type: 'image' | 'video';
}

function MediaPlaceholderComponent({ type }: MediaPlaceholderProps) {
  return (
    <View style={styles.container}>
      <Ionicons
        name={type === 'image' ? 'image-outline' : 'videocam-outline'}
        size={32}
        color={colors.textSecondary}
      />
      <Text style={styles.label}>{type === 'image' ? 'Image' : 'Video'}</Text>
    </View>
  );
}

export const MediaPlaceholder = memo(MediaPlaceholderComponent);

const styles = StyleSheet.create({
  container: {
    height: 200,
    backgroundColor: colors.placeholder,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  label: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
