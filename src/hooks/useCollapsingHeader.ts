import { useCallback, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const SCROLL_THRESHOLD = 5;
const HEADER_ANIM_DURATION = 200;

export function useCollapsingHeader() {
  const headerHeightRef = useRef(0);
  const lastScrollY = useRef(0);
  const headerOffset = useRef(new Animated.Value(0)).current;
  const headerVisible = useRef(true);
  const [headerHeight, setHeaderHeight] = useState(0);

  const showHeader = useCallback(() => {
    if (headerVisible.current) return;
    headerVisible.current = true;
    Animated.timing(headerOffset, {
      toValue: 0,
      duration: HEADER_ANIM_DURATION,
      useNativeDriver: true,
    }).start();
  }, [headerOffset]);

  const hideHeader = useCallback(() => {
    if (!headerVisible.current || headerHeightRef.current === 0) return;
    headerVisible.current = false;
    Animated.timing(headerOffset, {
      toValue: -headerHeightRef.current,
      duration: HEADER_ANIM_DURATION,
      useNativeDriver: true,
    }).start();
  }, [headerOffset]);

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    headerHeightRef.current = height;
    setHeaderHeight(height);
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const diff = currentY - lastScrollY.current;

      if (currentY <= 0) {
        showHeader();
      } else if (diff > SCROLL_THRESHOLD && currentY > 10) {
        hideHeader();
      } else if (diff < -SCROLL_THRESHOLD) {
        showHeader();
      }

      lastScrollY.current = currentY;
    },
    [hideHeader, showHeader],
  );

  return { headerOffset, headerHeight, onHeaderLayout, onScroll };
}
