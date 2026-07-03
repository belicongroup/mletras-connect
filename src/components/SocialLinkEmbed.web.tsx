import React, { memo, useCallback, useState } from 'react';
import { createElement } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { colors, spacing, typography } from '../theme';
import type { SocialLink } from '../utils/socialLinks';

interface SocialLinkEmbedProps {
  link: SocialLink;
}

function platformLabel(
  platform: SocialLink['platform'],
  strings: ReturnType<typeof useAuthLanguage>['strings'],
) {
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

function LinkCard({ link }: SocialLinkEmbedProps) {
  const { strings } = useAuthLanguage();
  const label = platformLabel(link.platform, strings);

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
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.url} numberOfLines={2}>
          {link.url}
        </Text>
        <Text style={styles.cta}>{strings.openSocialLink}</Text>
      </View>
      <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function SocialLinkEmbedComponent({ link }: SocialLinkEmbedProps) {
  const { strings } = useAuthLanguage();
  const [embedFailed, setEmbedFailed] = useState(false);
  const onEmbedError = useCallback(() => setEmbedFailed(true), []);
  const label = platformLabel(link.platform, strings);

  if (!link.embedUrl || embedFailed) {
    return <LinkCard link={link} />;
  }

  return (
    <View style={styles.embedWrap}>
      {createElement('iframe', {
        src: link.embedUrl,
        title: label,
        style: {
          width: '100%',
          height: link.embedHeight,
          border: 0,
          borderRadius: 12,
          backgroundColor: colors.drawer,
        },
        allow: 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share',
        allowFullScreen: true,
        loading: 'lazy',
        onError: onEmbedError,
      })}
      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL(link.url)}
        style={({ pressed }) => [styles.openRow, pressed && styles.pressed]}
      >
        <Text style={styles.openLabel}>{label}</Text>
        <Ionicons name="open-outline" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export const SocialLinkEmbed = memo(SocialLinkEmbedComponent);

const styles = StyleSheet.create({
  embedWrap: {
    marginTop: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.drawer,
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  openLabel: {
    ...typography.small,
    color: colors.primary,
  },
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
