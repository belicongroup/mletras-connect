import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEventListener } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import type { PostMedia } from '../types';

interface PostVideoProps {
  media: PostMedia;
  /** True when this is the video currently scrolled into view; drives autoplay. */
  isActive?: boolean;
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
 * Inline feed video with X-style behavior: autoplays muted + looping while in
 * view, exposes a mute toggle, and expands to fullscreen (with sound) on tap.
 */
function PostVideoComponent({ media, isActive = false }: PostVideoProps) {
  const ref = useRef<VideoView>(null);
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const isReady = media.processingStatus === 'ready';
  const aspectRatio = clampAspect(media.width, media.height);
  const source = isReady ? media.hlsUrl ?? media.url : null;

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEventListener(player, 'playingChange', ({ isPlaying: playing }) => setIsPlaying(playing));
  useEventListener(player, 'mutedChange', ({ muted: value }) => setMuted(value));

  // Autoplay only the in-view video; pause the rest so we never stack audio or
  // burn bandwidth on off-screen clips.
  useEffect(() => {
    if (!isReady) return;
    if (isActive) player.play();
    else player.pause();
  }, [isActive, isReady, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  const toggleMute = useCallback(() => setMuted((prev) => !prev), []);
  const openFullscreen = useCallback(() => {
    ref.current?.enterFullscreen();
  }, []);

  if (!isReady) {
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Expand video"
      style={[styles.container, { aspectRatio }]}
      onPress={openFullscreen}
    >
      <VideoView
        ref={ref}
        style={styles.poster}
        player={player}
        contentFit="contain"
        nativeControls={false}
        playsInline
        fullscreenOptions={{ enable: true }}
        onFullscreenEnter={() => setMuted(false)}
        onFullscreenExit={() => setMuted(true)}
      />

      {/* Poster shows until the first frame renders (or while paused off-screen). */}
      {!isPlaying && media.posterUrl ? (
        <Image style={styles.poster} source={{ uri: media.posterUrl }} contentFit="contain" />
      ) : null}

      {!isPlaying ? (
        <View pointerEvents="none" style={styles.playButton}>
          <Ionicons name="play" size={28} color="#FFFFFF" />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
        style={styles.muteButton}
        hitSlop={10}
        onPress={toggleMute}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#FFFFFF" />
      </Pressable>
    </Pressable>
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
  muteButton: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
