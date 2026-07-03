import React, { memo, useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

export interface MenuOption {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

interface OptionsMenuProps {
  options: MenuOption[];
  accessibilityLabel?: string;
}

/** Three-dot overflow menu for post/comment actions. */
function OptionsMenuComponent({ options, accessibilityLabel = 'More options' }: OptionsMenuProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  const handleSelect = useCallback(
    (option: MenuOption) => {
      close();
      option.onPress();
    },
    [close],
  );

  if (options.length === 0) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={styles.sheet}>
            {options.map((option) => (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                onPress={() => handleSelect(option)}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <Text style={[styles.optionLabel, option.destructive && styles.destructive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={close}
              style={({ pressed }) => [styles.option, styles.cancel, pressed && styles.pressed]}
            >
              <Text style={styles.optionLabel}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export const OptionsMenu = memo(OptionsMenuComponent);

const styles = StyleSheet.create({
  trigger: {
    padding: spacing.xs,
    marginLeft: 'auto',
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  option: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cancel: {
    borderBottomWidth: 0,
    marginTop: spacing.sm,
  },
  optionLabel: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
  },
  destructive: {
    color: colors.danger,
    ...typography.bodyBold,
  },
  pressed: {
    opacity: 0.7,
  },
});
