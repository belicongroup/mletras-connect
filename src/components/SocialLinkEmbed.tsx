import React, { memo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { colors, spacing, typography } from '../theme';
import type { SocialLink } from '../utils/socialLinks';

interface SocialLinkEmbedProps {
  link: SocialLink;
}

function platformLabel(platform: SocialLink['platform'], strings: ReturnType<typeof useAuthLanguage>['strings']) {
  switch (platform) {
    case 'tiktok':
      return strings.socialVideoTikTok;
    case 'instagram':
      return strings.socialVideoInstagram;
    case 'facebook':
      return strings.socialVideoFacebook;
  }
}

function platformIcon(platform: SocialLink['platform']): keyof typeof Ionicons.glyphMap {
  switch (platform) {
    case 'tiktok':
      return 'logo-tiktok';
    case 'instagram':
      return 'logo-instagram';
    case 'facebook':
      return 'logo-facebook';
  }
}

/** Native fallback: tappable preview card that opens the social post. */
function SocialLinkEmbedComponent({ link }: SocialLinkEmbedProps) {
  const { strings } = useAuthLanguage();

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(link.url)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={platformIcon(link.platform)} size={22} color={colors.text} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.title}>{platformLabel(link.platform, strings)}</Text>
        <Text style={styles.url} numberOfLines={2}>
          {link.url}
        </Text>
        <Text style={styles.cta}>{strings.openSocialLink}</Text>
      </View>
      <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

export const SocialLinkEmbed = memo(SocialLinkEmbedComponent);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.drawer,
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.placeholder,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.bodyBold,
    color: colors.text,
  },
  url: {
    ...typography.small,
    color: colors.textSecondary,
  },
  cta: {
    ...typography.small,
    color: colors.primary,
    marginTop: spacing.xs,
  },
});
