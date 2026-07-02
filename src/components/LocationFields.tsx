import React, { useMemo } from 'react';
import { SelectField } from './SelectField';
import { TextField } from './TextField';
import { AuthStrings } from '../constants/authStrings';
import {
  CountryCode,
  getCitiesForState,
  getCountryOptions,
  getStatesForCountry,
} from '../constants/locations';

export interface LocationFieldValues {
  country: CountryCode | '';
  stateCode: string;
  cityCode: string;
  customState: string;
  customCity: string;
}

interface LocationFieldsProps {
  strings: AuthStrings;
  values: LocationFieldValues;
  onCountryChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onCustomStateChange: (value: string) => void;
  onCustomCityChange: (value: string) => void;
}

export function LocationFields({
  strings,
  values,
  onCountryChange,
  onStateChange,
  onCityChange,
  onCustomStateChange,
  onCustomCityChange,
}: LocationFieldsProps) {
  const { country, stateCode, cityCode, customState, customCity } = values;
  const isOtherCountry = country === 'OTHER';
  const countryOptions = useMemo(() => getCountryOptions(strings), [strings]);
  const stateOptions = useMemo(() => getStatesForCountry(country), [country]);
  const cityOptions = useMemo(() => getCitiesForState(country, stateCode), [country, stateCode]);

  return (
    <>
      <SelectField
        label={strings.country}
        placeholder={strings.selectCountry}
        value={country}
        options={countryOptions}
        onChange={onCountryChange}
      />

      {isOtherCountry ? (
        <>
          <TextField
            label={strings.state}
            placeholder={strings.typeState}
            value={customState}
            onChangeText={onCustomStateChange}
          />
          <TextField
            label={strings.city}
            placeholder={strings.typeCity}
            value={customCity}
            onChangeText={onCustomCityChange}
          />
        </>
      ) : (
        <>
          <SelectField
            label={strings.state}
            placeholder={country ? strings.selectState : strings.selectCountryFirst}
            value={stateCode}
            options={stateOptions}
            onChange={onStateChange}
            disabled={!country}
          />
          <SelectField
            label={strings.city}
            placeholder={stateCode ? strings.selectCity : strings.selectStateFirst}
            value={cityCode}
            options={cityOptions}
            onChange={onCityChange}
            disabled={!stateCode}
          />
        </>
      )}
    </>
  );
}
