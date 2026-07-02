import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthHeader } from '../components/AuthHeader';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { EMAIL_REGEX } from '../constants/auth';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { RootStackParamList } from '../types';
import { colors, layout, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUpEmail'>;

export function SignUpEmailScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { strings } = useAuthLanguage();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleNext = () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError(strings.emailRequired);
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError(strings.emailInvalid);
      return;
    }

    navigation.navigate('OtpVerification', { email: trimmed });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { paddingTop: insets.top + spacing.xxl }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <AuthHeader />

        <View style={styles.actions}>
          <Text style={styles.heading}>{strings.createAccount}</Text>
          <TextField
            placeholder={strings.email}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (error) setError('');
            }}
            error={error}
            containerStyle={styles.fieldWrap}
          />
          <Button label={strings.next} onPress={handleNext} fullWidth />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {strings.hasAccount}{' '}
            <Text
              accessibilityRole="link"
              style={styles.footerLink}
              onPress={() => navigation.navigate('Auth')}
            >
              {strings.signIn}
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
  },
  heading: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xxl,
  },
  actions: {
    gap: spacing.md,
  },
  fieldWrap: {
    marginBottom: 0,
  },
  footer: {
    marginTop: spacing.xxl * 2,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  footerLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
