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
import { useApp } from '../context/AppContext';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { mapAuthError } from '../services/authService';
import { RootStackParamList } from '../types';
import { colors, layout, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export function AuthScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signIn } = useApp();
  const { strings } = useAuthLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim()) {
      setError(strings.emailRequired);
      return;
    }
    if (!password) {
      setError(strings.passwordRequirementsTitle);
      return;
    }

    setLoading(true);
    setError('');
    const result = await signIn(email.trim(), password);
    setLoading(false);

    if (!result.ok) {
      setError(
        mapAuthError(result.error as Parameters<typeof mapAuthError>[0], strings),
      );
    }
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
        <AuthHeader showSubtext={false} />

        <View style={styles.actions}>
          <TextField
            placeholder={strings.email}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            containerStyle={styles.fieldWrap}
          />
          <TextField
            label={strings.password}
            placeholder={strings.passwordPlaceholder}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={setPassword}
            error={error}
            containerStyle={styles.fieldWrap}
          />

          <Button
            label={strings.next}
            onPress={handleSignIn}
            loading={loading}
            fullWidth
          />
          <Button
            label={strings.forgotPassword}
            variant="outline"
            onPress={() => navigation.navigate('ForgotPassword')}
            fullWidth
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {strings.noAccount}{' '}
            <Text
              accessibilityRole="link"
              style={styles.footerLink}
              onPress={() => navigation.navigate('SignUpEmail')}
            >
              {strings.signUp}
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
