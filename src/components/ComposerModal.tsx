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
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { MediaPlaceholder } from './MediaPlaceholder';
import { colors, spacing, typography } from '../theme';

const MAX_CHARS = 280;

interface ComposerModalProps {
  visible: boolean;
  text: string;
  hasImage: boolean;
  hasVideo: boolean;
  onChangeText: (text: string) => void;
  onToggleImage: () => void;
  onToggleVideo: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

function ComposerModalComponent({
  visible,
  text,
  hasImage,
  hasVideo,
  onChangeText,
  onToggleImage,
  onToggleVideo,
  onClose,
  onSubmit,
}: ComposerModalProps) {
  const canSubmit = text.trim().length > 0;
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

            {hasImage ? <MediaPlaceholder type="image" /> : null}
            {hasVideo ? <MediaPlaceholder type="video" /> : null}

            <View style={styles.toolbar}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: hasImage }}
                onPress={onToggleImage}
                style={({ pressed }) => [styles.toolBtn, pressed && styles.pressed]}
              >
                <Ionicons
                  name={hasImage ? 'image' : 'image-outline'}
                  size={22}
                  color={hasImage ? colors.primary : colors.textSecondary}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: hasVideo }}
                onPress={onToggleVideo}
                style={({ pressed }) => [styles.toolBtn, pressed && styles.pressed]}
              >
                <Ionicons
                  name={hasVideo ? 'videocam' : 'videocam-outline'}
                  size={22}
                  color={hasVideo ? colors.primary : colors.textSecondary}
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
