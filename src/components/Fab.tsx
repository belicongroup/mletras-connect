import React, { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout } from '../theme';

interface FabProps {
  onPress: () => void;
}

function FabComponent({ onPress }: FabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Create post"
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <Ionicons name="add" size={28} color="#FFFFFF" />
    </Pressable>
  );
}

export const Fab = memo(FabComponent);

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: layout.fabSize,
    height: layout.fabSize,
    borderRadius: layout.fabSize / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.primaryPressed,
  },
});
