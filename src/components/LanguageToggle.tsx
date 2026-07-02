import React, { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { colors, spacing } from '../theme';

const TRACK_WIDTH = 184;
const TRACK_HEIGHT = 28;
const TRACK_PADDING = 2;

interface LanguageToggleProps {
  align?: 'center' | 'start';
}

function LanguageToggleComponent({ align = 'center' }: LanguageToggleProps) {
  const { locale, setLocale } = useAuthLanguage();
  const isEnglish = locale === 'en';
  const slide = useRef(new Animated.Value(isEnglish ? 0 : 1)).current;
  const thumbWidth = (TRACK_WIDTH - TRACK_PADDING * 2) / 2;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: isEnglish ? 0 : 1,
      useNativeDriver: true,
      tension: 280,
      friction: 22,
    }).start();
  }, [isEnglish, slide]);

  const thumbTranslateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, thumbWidth],
  });

  return (
    <View style={[styles.wrap, align === 'center' ? styles.wrapCenter : styles.wrapStart]}>
      <View
        style={styles.track}
        accessibilityRole="tablist"
        accessibilityLabel="Language"
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: thumbWidth,
              transform: [{ translateX: thumbTranslateX }],
            },
          ]}
        />

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: isEnglish }}
          accessibilityLabel="English"
          onPress={() => setLocale('en')}
          style={({ pressed }) => [styles.segment, pressed && styles.segmentPressed]}
        >
          <Text
            style={[styles.label, isEnglish ? styles.labelActive : styles.labelInactive]}
            numberOfLines={1}
          >
            English
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: !isEnglish }}
          accessibilityLabel="Español"
          onPress={() => setLocale('es')}
          style={({ pressed }) => [styles.segment, pressed && styles.segmentPressed]}
        >
          <Text
            style={[styles.label, !isEnglish ? styles.labelActive : styles.labelInactive]}
            numberOfLines={1}
          >
            Español
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export const LanguageToggle = memo(LanguageToggleComponent);

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  wrapCenter: {
    alignSelf: 'center',
  },
  wrapStart: {
    alignSelf: 'flex-start',
    marginBottom: 0,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.border,
    padding: TRACK_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    borderRadius: (TRACK_HEIGHT - TRACK_PADDING * 2) / 2,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  segment: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentPressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    letterSpacing: 0.1,
  },
  labelActive: {
    color: '#FFFFFF',
  },
  labelInactive: {
    color: colors.textSecondary,
  },
});
