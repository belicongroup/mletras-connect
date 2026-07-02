import React, { useMemo, useState } from 'react';
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
import { PasswordRequirements } from '../components/PasswordRequirements';
import { TextField } from '../components/TextField';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { RootStackParamList } from '../types';
import { getPasswordChecks, isPasswordValid } from '../utils/password';
import { colors, layout, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePassword'>;

export function CreatePasswordScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { strings } = useAuthLanguage();
  const { email, flow = 'signup' } = route.params;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const checks = useMemo(
    () => getPasswordChecks(password, confirmPassword),
    [password, confirmPassword],
  );

  const handleNext = () => {
    if (!isPasswordValid(checks)) {
      if (!checks.match) {
        setError(strings.passwordMismatch);
      } else {
        setError(strings.passwordRequirementsTitle);
      }
      return;
    }

    if (flow === 'reset') {
      navigation.popToTop();
      return;
    }

    navigation.navigate('ProfileSetup', { email, password });
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
            {flow === 'reset' ? strings.createNewPassword : strings.createPassword}
          </Text>
          <Text style={styles.description}>
            {strings.passwordDescription}{'\n'}
            <Text style={styles.email}>{email}</Text>
          </Text>

          <TextField
            label={strings.password}
            placeholder={strings.passwordPlaceholder}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (error) setError('');
            }}
            containerStyle={styles.fieldWrap}
          />
          <TextField
            label={strings.confirmPassword}
            placeholder={strings.confirmPasswordPlaceholder}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              if (error) setError('');
            }}
            error={error}
            containerStyle={styles.fieldWrap}
          />

          <PasswordRequirements checks={checks} strings={strings} />

          <Button label={strings.next} onPress={handleNext} fullWidth />
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
  fieldWrap: {
    marginBottom: 0,
  },
});
