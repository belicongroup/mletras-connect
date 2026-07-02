import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthStrings } from '../constants/authStrings';
import { PasswordChecks } from '../utils/password';
import { colors, spacing, typography } from '../theme';

interface PasswordRequirementsProps {
  checks: PasswordChecks;
  strings: AuthStrings;
}

function PasswordRequirementsComponent({ checks, strings }: PasswordRequirementsProps) {
  const items = [
    { key: 'minLength', label: strings.passwordMinLength, met: checks.minLength },
    { key: 'uppercase', label: strings.passwordUppercase, met: checks.uppercase },
    { key: 'lowercase', label: strings.passwordLowercase, met: checks.lowercase },
    { key: 'number', label: strings.passwordNumber, met: checks.number },
    { key: 'match', label: strings.passwordsMatch, met: checks.match },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{strings.passwordRequirementsTitle}</Text>
      {items.map((item) => (
        <View key={item.key} style={styles.row}>
          <Ionicons
            name={item.met ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={item.met ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.label, item.met && styles.labelMet]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export const PasswordRequirements = memo(PasswordRequirementsComponent);

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.small,
    color: colors.textSecondary,
  },
  labelMet: {
    color: colors.text,
  },
});
