import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { RootStackParamList } from '../types';
import { colors, layout, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'OtpVerification'>;

const RESEND_COOLDOWN_SECONDS = 60;

export function OtpVerificationScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { strings } = useAuthLanguage();
  const { email, flow = 'signup' } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(true);
  const [resendSeconds, setResendSeconds] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    const timer = setTimeout(() => setPending(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError(strings.codeRequired);
      return;
    }

    setLoading(true);
    setError('');
    await new Promise((resolve) => setTimeout(resolve, 800));
    setLoading(false);

    if (flow === 'reset') {
      navigation.navigate('CreatePassword', { email, flow: 'reset' });
      return;
    }

    navigation.navigate('CreatePassword', { email });
  };

  const handleResend = () => {
    if (resendSeconds > 0) return;
    setPending(true);
    setResendSeconds(RESEND_COOLDOWN_SECONDS);
    setCode('');
    setError('');
    setTimeout(() => setPending(false), 1500);
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
          <Text style={styles.heading}>
            {flow === 'reset' ? strings.resetPassword : strings.verifyEmail}
          </Text>
          <Text style={styles.description}>
            {strings.verificationSent}{'\n'}
            <Text style={styles.email}>{email}</Text>
          </Text>

          {pending ? (
            <View style={styles.pendingCard}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.pendingText}>{strings.sendingCode}</Text>
            </View>
          ) : (
            <>
              <TextField
                placeholder={strings.verificationCode}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={(value) => {
                  setCode(value.replace(/\D/g, ''));
                  if (error) setError('');
                }}
                error={error}
                containerStyle={styles.fieldWrap}
              />
              <Button
                label={strings.verify}
                onPress={handleVerify}
                loading={loading}
                fullWidth
              />
            </>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={pending || resendSeconds > 0}
            onPress={handleResend}
            style={styles.resendWrap}
          >
            <Text
              style={[
                styles.resendText,
                (pending || resendSeconds > 0) && styles.resendDisabled,
              ]}
            >
              {resendSeconds > 0
                ? strings.resendCodeIn(resendSeconds)
                : strings.resendCode}
            </Text>
          </Pressable>
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
    marginBottom: spacing.md,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  email: {
    color: colors.text,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.md,
  },
  pendingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
  },
  pendingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  fieldWrap: {
    marginBottom: 0,
  },
  resendWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  resendText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  resendDisabled: {
    color: colors.textSecondary,
    fontWeight: '400',
  },
});
