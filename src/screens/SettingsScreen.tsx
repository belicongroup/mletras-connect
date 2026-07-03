import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageToggle } from '../components/LanguageToggle';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { colors, layout, spacing, typography } from '../theme';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { strings } = useAuthLanguage();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={strings.settings} onBack={() => navigation.goBack()} />

      <View style={[styles.content, { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }]}>
        <Text style={styles.section}>{strings.language}</Text>
        <View style={styles.languageRow}>
          <LanguageToggle align="start" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xxl,
  },
  section: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  languageRow: {
    alignItems: 'flex-start',
  },
});
