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

// X-style uniform framing: every video sits in a consistent card regardless of
// its native dimensions. Landscape is capped at 16:9 and portrait at 4:5 so
// tall phone clips don't dominate the feed. Anything outside this range is
// letterboxed (contain) inside the clamped frame so nothing is ever cropped.
const MIN_ASPECT = 4 / 5; // 0.8 — tallest allowed (portrait)
const MAX_ASPECT = 16 / 9; // 1.778 — widest allowed (landscape)

function clampAspect(width?: number, height?: number): number {
  if (!width || !height) return 16 / 9;
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, width / height));
}

/**
 * Inline HLS video with poster-first playback. The player is only given a
 * source once the user taps play, so idle feed items stay cheap.
 */
function PostVideoComponent({ media }: PostVideoProps) {
  const [active, setActive] = useState(false);
  const aspectRatio = clampAspect(media.width, media.height);

  const player = useVideoPlayer(active ? media.hlsUrl ?? media.url : null, (p) => {
    p.loop = false;
    p.play();
  });

  if (media.processingStatus !== 'ready') {
    return (
      <View style={[styles.container, { aspectRatio }]}>
        {media.posterUrl ? (
          <Image style={styles.poster} source={{ uri: media.posterUrl }} contentFit="contain" />
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
          <Image style={styles.poster} source={{ uri: media.posterUrl }} contentFit="contain" />
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
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
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
