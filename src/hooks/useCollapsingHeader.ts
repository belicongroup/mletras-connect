import { useCallback, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export function useCollapsingHeader() {
  const headerHeightRef = useRef(0);
  const lastScrollY = useRef(0);
  const offsetRef = useRef(0);
  const headerOffset = useRef(new Animated.Value(0)).current;
  const [headerHeight, setHeaderHeight] = useState(0);

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    headerHeightRef.current = height;
    setHeaderHeight(height);
    // Keep current offset in range when layout changes (e.g. safe area changes).
    if (offsetRef.current > height) {
      offsetRef.current = height;
      headerOffset.setValue(-height);
    }
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const maxOffset = headerHeightRef.current;
      if (maxOffset <= 0) return;

      const currentY = Math.max(0, event.nativeEvent.contentOffset.y);
      const deltaY = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      let nextOffset = offsetRef.current + deltaY;
      if (nextOffset < 0) nextOffset = 0;
      if (nextOffset > maxOffset) nextOffset = maxOffset;

      if (nextOffset !== offsetRef.current) {
        offsetRef.current = nextOffset;
        headerOffset.setValue(-nextOffset);
      }
    },
    [headerOffset],
  );

  return { headerOffset, headerHeight, onHeaderLayout, onScroll };
}
