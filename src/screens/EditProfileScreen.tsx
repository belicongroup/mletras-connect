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
import { Button } from '../components/Button';
import { InstrumentChecklist } from '../components/InstrumentChecklist';
import { LocationFields } from '../components/LocationFields';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextField } from '../components/TextField';
import {
  CountryCode,
  getCountryLabel,
  getStateLabel,
  resolveLocationFromProfile,
} from '../constants/locations';
import { useApp } from '../context/AppContext';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { Instrument, RootStackParamList } from '../types';
import { colors, layout, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { currentUser, updateProfile } = useApp();
  const { strings } = useAuthLanguage();

  const initialLocation = useMemo(
    () =>
      currentUser
        ? resolveLocationFromProfile(currentUser.country, currentUser.state, currentUser.city)
        : {
            country: '' as CountryCode | '',
            stateCode: '',
            cityCode: '',
            customState: '',
            customCity: '',
          },
    [currentUser],
  );

  const [firstName, setFirstName] = useState(currentUser?.firstName ?? '');
  const [lastName, setLastName] = useState(currentUser?.lastName ?? '');
  const [country, setCountry] = useState<CountryCode | ''>(initialLocation.country);
  const [stateCode, setStateCode] = useState(initialLocation.stateCode);
  const [cityCode, setCityCode] = useState(initialLocation.cityCode);
  const [customState, setCustomState] = useState(initialLocation.customState);
  const [customCity, setCustomCity] = useState(initialLocation.customCity);
  const [instruments, setInstruments] = useState<Instrument[]>(currentUser?.instruments ?? []);
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

  const handleSave = async () => {
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

    const result = await updateProfile({
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      country: getCountryLabel(country),
      state: resolvedState,
      city: resolvedCity,
      instruments,
    });

    setLoading(false);

    if (!result.ok) {
      setError(strings.updateFailed);
      return;
    }

    navigation.goBack();
  };

  if (!currentUser) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScreenHeader title={strings.editProfile} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          label={strings.usernameLabel}
          value={currentUser.username}
          editable={false}
          autoCapitalize="none"
          hint={strings.usernameLockedHint}
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

        <Button label={strings.saveChanges} onPress={handleSave} loading={loading} fullWidth />
        <Button
          label={strings.cancel}
          variant="outline"
          onPress={() => navigation.goBack()}
          disabled={loading}
          fullWidth
          style={styles.cancelButton}
        />
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
    padding: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  error: {
    ...typography.small,
    color: colors.danger,
    marginBottom: spacing.lg,
  },
  cancelButton: {
    marginTop: spacing.md,
  },
});
