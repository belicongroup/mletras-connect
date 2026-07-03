import React, { memo, useMemo } from 'react';
import { Linking, StyleSheet, Text, type TextStyle } from 'react-native';
import { colors } from '../theme';
import { linkifyText } from '../utils/linkify';

interface LinkedPostTextProps {
  text: string;
  style?: TextStyle;
}

function LinkedPostTextComponent({ text, style }: LinkedPostTextProps) {
  const segments = useMemo(() => linkifyText(text), [text]);

  return (
    <Text style={style}>
      {segments.map((segment, index) =>
        segment.type === 'link' ? (
          <Text
            key={`${segment.value}-${index}`}
            style={styles.link}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(segment.value)}
          >
            {segment.value}
          </Text>
        ) : (
          <Text key={`text-${index}`}>{segment.value}</Text>
        ),
      )}
    </Text>
  );
}

export const LinkedPostText = memo(LinkedPostTextComponent);

const styles = StyleSheet.create({
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
