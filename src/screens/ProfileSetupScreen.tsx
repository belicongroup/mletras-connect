import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthHeader } from '../components/AuthHeader';
import { Button } from '../components/Button';
import { InstrumentChecklist } from '../components/InstrumentChecklist';
import { LocationFields } from '../components/LocationFields';
import { TextField } from '../components/TextField';
import {
  CountryCode,
  getCountryLabel,
  getStateLabel,
} from '../constants/locations';
import { useApp } from '../context/AppContext';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { Instrument, RootStackParamList } from '../types';
import { colors, layout, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;

export function ProfileSetupScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const { signUp } = useApp();
  const { strings } = useAuthLanguage();
  const email = route.params?.email ?? '';
  const password = route.params?.password ?? '';

  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState<CountryCode | ''>('');
  const [stateCode, setStateCode] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [customState, setCustomState] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isOtherCountry = country === 'OTHER';

  const handleCountryChange = (value: string) => {
    setCountry(value as CountryCode);
    setStateCode('');
    setCityCode('');
    setCustomState('');
    setCustomCity('');
    if (error) setError('');
  };

  const handleStateChange = (value: string) => {
    setStateCode(value);
    setCityCode('');
    if (error) setError('');
  };

  const handleSubmit = async () => {
    if (!password) {
      setError(strings.createAccountFailed);
      return;
    }
    if (!username.trim()) {
      setError(strings.usernameRequired);
      return;
    }
    if (!country) {
      setError(strings.countryRequired);
      return;
    }

    if (isOtherCountry) {
      if (!customState.trim() || !customCity.trim()) {
        setError(strings.locationRequired);
        return;
      }
    } else if (!stateCode || !cityCode) {
      setError(strings.locationRequired);
      return;
    }

    if (instruments.length === 0) {
      setError(strings.instrumentsRequired);
      return;
    }

    setLoading(true);
    setError('');

    const resolvedState = isOtherCountry ? customState.trim() : getStateLabel(country, stateCode);
    const resolvedCity = isOtherCountry ? customCity.trim() : cityCode;

    const result = await signUp({
      username: username.trim(),
      email,
      password,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      country: getCountryLabel(country),
      state: resolvedState,
      city: resolvedCity,
      instruments,
    });

    setLoading(false);

    if (!result.ok) {
      if (result.error === 'usernameTaken' || result.error === 'emailTaken') {
        setError(strings.usernameTaken);
      } else {
        setError(result.error ?? strings.createAccountFailed);
      }
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

        <Text style={styles.title}>{strings.profileTitle}</Text>
        <Text style={styles.subtitle}>{strings.profileSubtitle}</Text>

        <TextField
          label={strings.username}
          placeholder={strings.usernamePlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          hint={strings.usernamePermanentNote}
        />

        <TextField
          label={strings.firstName}
          placeholder={strings.optional}
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextField
          label={strings.lastName}
          placeholder={strings.optional}
          value={lastName}
          onChangeText={setLastName}
        />

        <LocationFields
          strings={strings}
          values={{ country, stateCode, cityCode, customState, customCity }}
          onCountryChange={handleCountryChange}
          onStateChange={handleStateChange}
          onCityChange={setCityCode}
          onCustomStateChange={setCustomState}
          onCustomCityChange={setCustomCity}
        />

        <InstrumentChecklist
          title={strings.instrumentsPlayed}
          selected={instruments}
          onChange={setInstruments}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label={strings.joinFeed} onPress={handleSubmit} loading={loading} fullWidth />
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
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
  },
  error: {
    ...typography.small,
    color: colors.danger,
    marginBottom: spacing.lg,
  },
});
