import React, { memo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, spacing, typography } from '../theme';

const MAX_CHARS = 280;

interface ComposerModalProps {
  visible: boolean;
  text: string;
  imageUri: string | null;
  submitting: boolean;
  onChangeText: (text: string) => void;
  onPickImage: () => void;
  onRemoveImage: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

function ComposerModalComponent({
  visible,
  text,
  imageUri,
  submitting,
  onChangeText,
  onPickImage,
  onRemoveImage,
  onClose,
  onSubmit,
}: ComposerModalProps) {
  const canSubmit = (text.trim().length > 0 || imageUri !== null) && !submitting;
  const remaining = MAX_CHARS - text.length;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Button
              label="Post"
              onPress={onSubmit}
              disabled={!canSubmit}
              loading={submitting}
              style={styles.postBtn}
            />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.body}>
            <TextInput
              autoFocus
              multiline
              placeholder="What's happening in the regional scene?"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              value={text}
              onChangeText={onChangeText}
              maxLength={MAX_CHARS}
            />

            {imageUri ? (
              <View style={styles.previewWrap}>
                <Image style={styles.preview} source={{ uri: imageUri }} contentFit="cover" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove image"
                  onPress={onRemoveImage}
                  style={styles.removeBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.toolbar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add image"
                onPress={onPickImage}
                style={({ pressed }) => [styles.toolBtn, pressed && styles.pressed]}
              >
                <Ionicons
                  name={imageUri ? 'image' : 'image-outline'}
                  size={22}
                  color={imageUri ? colors.primary : colors.textSecondary}
                />
              </Pressable>
              <Text style={[styles.counter, remaining < 20 && styles.counterWarn]}>
                {remaining}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export const ComposerModal = memo(ComposerModalComponent);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  postBtn: {
    minHeight: 36,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  body: {
    padding: spacing.lg,
  },
  input: {
    ...typography.body,
    color: colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  previewWrap: {
    marginTop: spacing.md,
    position: 'relative',
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    backgroundColor: colors.placeholder,
  },
  removeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  toolBtn: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  counter: {
    ...typography.small,
    color: colors.textSecondary,
    marginLeft: 'auto',
  },
  counterWarn: {
    color: colors.danger,
  },
  pressed: {
    opacity: 0.7,
  },
});
