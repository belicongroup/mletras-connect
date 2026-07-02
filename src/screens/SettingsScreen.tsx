import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageToggle } from '../components/LanguageToggle';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { colors, layout, spacing, typography } from '../theme';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const { strings } = useAuthLanguage();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{strings.settings}</Text>
      </View>

      <View style={[styles.content, { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }]}>
        <Text style={styles.section}>{strings.language}</Text>
        <View style={styles.languageRow}>
          <LanguageToggle align="start" />
        </View>

        <Text style={styles.section}>{strings.appearance}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>{strings.theme}</Text>
          <Text style={styles.value}>{strings.dark}</Text>
        </View>

        <Text style={styles.section}>{strings.about}</Text>
        <Text style={styles.about}>{strings.aboutDescription}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
  },
  content: {
    padding: spacing.xxl,
  },
  section: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  languageRow: {
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    ...typography.body,
    color: colors.text,
  },
  value: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  about: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
