import React, { memo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import type { PostMedia } from '../types';

interface PostVideoProps {
  media: PostMedia;
}

/**
 * Inline HLS video with poster-first playback. The player is only given a
 * source once the user taps play, so idle feed items stay cheap.
 */
function PostVideoComponent({ media }: PostVideoProps) {
  const [active, setActive] = useState(false);
  const aspectRatio = media.width && media.height ? media.width / media.height : 16 / 9;

  const player = useVideoPlayer(active ? media.hlsUrl ?? media.url : null, (p) => {
    p.loop = false;
    p.play();
  });

  if (media.processingStatus !== 'ready') {
    return (
      <View style={[styles.container, { aspectRatio }]}>
        {media.posterUrl ? (
          <Image style={styles.poster} source={{ uri: media.posterUrl }} contentFit="cover" />
        ) : null}
        <View style={styles.overlay}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.overlayText}>
            {media.processingStatus === 'failed' ? 'Video unavailable' : 'Processing video…'}
          </Text>
        </View>
      </View>
    );
  }

  if (!active) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Play video"
        style={[styles.container, { aspectRatio }]}
        onPress={() => setActive(true)}
      >
        {media.posterUrl ? (
          <Image style={styles.poster} source={{ uri: media.posterUrl }} contentFit="cover" />
        ) : null}
        <View style={styles.playButton}>
          <Ionicons name="play" size={28} color="#FFFFFF" />
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { aspectRatio }]}>
      <VideoView style={styles.poster} player={player} contentFit="contain" nativeControls />
    </View>
  );
}

export const PostVideo = memo(PostVideoComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.placeholder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  poster: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.overlay,
  },
  overlayText: {
    ...typography.small,
    color: '#FFFFFF',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
