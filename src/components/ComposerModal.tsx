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

export interface PickedMedia {
  uri: string;
  kind: 'image' | 'video';
  width?: number;
  height?: number;
}

interface ComposerModalProps {
  visible: boolean;
  text: string;
  media: PickedMedia[];
  submitting: boolean;
  /** 0..1 aggregate upload progress, or null when not uploading. */
  uploadProgress: number | null;
  submitError?: string | null;
  canAddMore: boolean;
  onChangeText: (text: string) => void;
  onAddMedia: () => void;
  onRemoveMedia: (index: number) => void;
  onClose: () => void;
  onSubmit: () => void;
}

function ComposerModalComponent({
  visible,
  text,
  media,
  submitting,
  uploadProgress,
  submitError,
  canAddMore,
  onChangeText,
  onAddMedia,
  onRemoveMedia,
  onClose,
  onSubmit,
}: ComposerModalProps) {
  const canSubmit = (text.trim().length > 0 || media.length > 0) && !submitting;
  const remaining = MAX_CHARS - text.length;
  const progressPct = uploadProgress !== null ? Math.round(uploadProgress * 100) : 0;

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

            {media.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbs}>
                {media.map((item, index) => (
                  <View key={`${item.uri}-${index}`} style={styles.thumbWrap}>
                    {item.kind === 'video' ? (
                      <View style={[styles.thumb, styles.videoThumb]}>
                        <Ionicons name="videocam" size={22} color={colors.text} />
                      </View>
                    ) : (
                      <Image style={styles.thumb} source={{ uri: item.uri }} contentFit="cover" />
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove media"
                      onPress={() => onRemoveMedia(index)}
                      style={styles.removeBtn}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={16} color={colors.text} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

            {submitting && uploadProgress !== null ? (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                </View>
                <Text style={styles.progressLabel}>Optimizing and uploading… {progressPct}%</Text>
              </View>
            ) : null}

            <View style={styles.toolbar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add photo or video"
                onPress={onAddMedia}
                disabled={!canAddMore}
                style={({ pressed }) => [
                  styles.toolBtn,
                  pressed && styles.pressed,
                  !canAddMore && styles.toolBtnDisabled,
                ]}
              >
                <Ionicons
                  name={media.length > 0 ? 'images' : 'images-outline'}
                  size={22}
                  color={media.length > 0 ? colors.primary : colors.textSecondary}
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
  thumbs: {
    marginTop: spacing.md,
  },
  thumbWrap: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: colors.placeholder,
  },
  videoThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.placeholder,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.small,
    color: colors.danger,
    marginTop: spacing.md,
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
  toolBtnDisabled: {
    opacity: 0.4,
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
