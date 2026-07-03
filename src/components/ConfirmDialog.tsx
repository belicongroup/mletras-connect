import React, { memo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, spacing, typography } from '../theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Centered confirmation dialog with title, message, and action buttons. */
function ConfirmDialogComponent({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" />
        <View style={styles.dialog}>
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onConfirm}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <Text style={[styles.optionLabel, destructive && styles.destructive]}>{confirmLabel}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.option, styles.cancel, pressed && styles.pressed]}
          >
            <Text style={styles.optionLabel}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export const ConfirmDialog = memo(ConfirmDialogComponent);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: layout.maxContentWidth - spacing.xxl * 2,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  option: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cancel: {
    borderTopWidth: StyleSheet.hairlineWidth,
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
