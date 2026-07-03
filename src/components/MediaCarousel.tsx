import React, { memo, useCallback, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  PixelRatio,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { pickImageUrl } from '../services/mediaService';
import { colors, spacing } from '../theme';
import type { PostMedia } from '../types';

interface MediaCarouselProps {
  media: PostMedia[];
}

/**
 * Swipeable image carousel with responsive variant selection and LQIP
 * placeholders. A single image renders without paging chrome.
 */
function MediaCarouselComponent({ media }: MediaCarouselProps) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  const targetPx = width > 0 ? Math.round(width * PixelRatio.get()) : 1080;

  const renderImage = (item: PostMedia, key: number) => (
    <Image
      key={key}
      style={[styles.media, { width: width || '100%' }]}
      source={{ uri: pickImageUrl(item, targetPx) }}
      placeholder={item.lqip ? { uri: item.lqip } : undefined}
      placeholderContentFit="cover"
      contentFit="cover"
      transition={150}
      cachePolicy="memory-disk"
      recyclingKey={pickImageUrl(item, targetPx)}
    />
  );

  if (media.length === 1) {
    return (
      <View style={styles.container} onLayout={onLayout}>
        {renderImage(media[0], 0)}
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {media.map(renderImage)}
      </ScrollView>
      <View style={styles.dots}>
        {media.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

export const MediaCarousel = memo(MediaCarouselComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.placeholder,
  },
  media: {
    aspectRatio: 4 / 3,
  },
  dots: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.overlay,
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
  },
});
