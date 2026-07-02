import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HEADER_SUBTEXT } from '../constants/auth';
import { LanguageToggle } from './LanguageToggle';
import { colors, spacing, typography } from '../theme';

interface AuthHeaderProps {
  showSubtext?: boolean;
  showLanguageToggle?: boolean;
}

function AuthHeaderComponent({
  showSubtext = true,
  showLanguageToggle = true,
}: AuthHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={[styles.logo, !showSubtext && styles.logoOnly]}>MLetras Connect</Text>
      {showLanguageToggle ? <LanguageToggle /> : null}
      {showSubtext ? <Text style={styles.subtitle}>{HEADER_SUBTEXT}</Text> : null}
    </View>
  );
}

export const AuthHeader = memo(AuthHeaderComponent);

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xxl * 2,
  },
  logo: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  logoOnly: {
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
