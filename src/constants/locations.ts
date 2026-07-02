import { AuthStrings } from './authStrings';

export type CountryCode = 'US' | 'MX' | 'OTHER';

export interface LocationState {
  label: string;
  cities: string[];
}

export interface LocationCountry {
  label: string;
  states: Record<string, LocationState>;
}

export const LOCATIONS: Record<CountryCode, LocationCountry> = {
  US: {
    label: 'United States',
    states: {
      california: {
        label: 'California',
        cities: ['Los Angeles', 'San Diego', 'San Francisco'],
      },
      texas: {
        label: 'Texas',
        cities: ['Houston', 'Dallas', 'San Antonio'],
      },
      florida: {
        label: 'Florida',
        cities: ['Miami', 'Orlando', 'Tampa'],
      },
      'new-york': {
        label: 'New York',
        cities: ['New York City', 'Buffalo', 'Rochester'],
      },
      illinois: {
        label: 'Illinois',
        cities: ['Chicago', 'Aurora', 'Naperville'],
      },
      arizona: {
        label: 'Arizona',
        cities: ['Phoenix', 'Tucson', 'Mesa'],
      },
      georgia: {
        label: 'Georgia',
        cities: ['Atlanta', 'Augusta', 'Savannah'],
      },
    },
  },
  MX: {
    label: 'Mexico',
    states: {
      cdmx: {
        label: 'Ciudad de México',
        cities: ['Ciudad de México', 'Coyoacán', 'Iztapalapa'],
      },
      jalisco: {
        label: 'Jalisco',
        cities: ['Guadalajara', 'Zapopan', 'Puerto Vallarta'],
      },
      'nuevo-leon': {
        label: 'Nuevo León',
        cities: ['Monterrey', 'Guadalupe', 'San Nicolás'],
      },
      tamaulipas: {
        label: 'Tamaulipas',
        cities: ['Reynosa', 'Matamoros', 'Nuevo Laredo'],
      },
      sinaloa: {
        label: 'Sinaloa',
        cities: ['Culiacán', 'Mazatlán', 'Los Mochis'],
      },
      puebla: {
        label: 'Puebla',
        cities: ['Puebla', 'Tehuacán', 'Atlixco'],
      },
      guanajuato: {
        label: 'Guanajuato',
        cities: ['León', 'Irapuato', 'Celaya'],
      },
      chihuahua: {
        label: 'Chihuahua',
        cities: ['Ciudad Juárez', 'Chihuahua', 'Delicias'],
      },
    },
  },
  OTHER: {
    label: 'Other',
    states: {},
  },
};


export function getCountryOptions(strings: Pick<AuthStrings, 'countryUnitedStates' | 'countryMexico' | 'countryOther'>) {
  return [
    { value: 'US', label: strings.countryUnitedStates },
    { value: 'MX', label: strings.countryMexico },
    { value: 'OTHER', label: strings.countryOther },
  ];
}

export function getStatesForCountry(countryCode: CountryCode | '') {
  if (!countryCode) return [];
  const country = LOCATIONS[countryCode];
  return Object.entries(country.states).map(([value, state]) => ({
    value,
    label: state.label,
  }));
}

export function getCitiesForState(countryCode: CountryCode | '', stateCode: string) {
  if (!countryCode || !stateCode) return [];
  const state = LOCATIONS[countryCode]?.states[stateCode];
  if (!state) return [];
  return state.cities.map((city) => ({ value: city, label: city }));
}

export function getStateLabel(countryCode: CountryCode, stateCode: string) {
  if (countryCode === 'OTHER') return stateCode;
  return LOCATIONS[countryCode]?.states[stateCode]?.label ?? '';
}

export function getCountryLabel(countryCode: CountryCode) {
  return LOCATIONS[countryCode]?.label ?? '';
}

export interface ResolvedLocation {
  country: CountryCode | '';
  stateCode: string;
  cityCode: string;
  customState: string;
  customCity: string;
}

export function resolveLocationFromProfile(
  country: string,
  state: string,
  city: string,
): ResolvedLocation {
  let countryCode: CountryCode | '' = '';
  for (const code of Object.keys(LOCATIONS) as CountryCode[]) {
    if (LOCATIONS[code].label.toLowerCase() === country.trim().toLowerCase()) {
      countryCode = code;
      break;
    }
  }

  if (countryCode === 'OTHER' || !countryCode) {
    return {
      country: countryCode || 'OTHER',
      stateCode: '',
      cityCode: '',
      customState: state,
      customCity: city,
    };
  }

  let stateCode = '';
  for (const [code, stateData] of Object.entries(LOCATIONS[countryCode].states)) {
    if (stateData.label === state) {
      stateCode = code;
      break;
    }
  }

  if (!stateCode) {
    return {
      country: 'OTHER',
      stateCode: '',
      cityCode: '',
      customState: state,
      customCity: city,
    };
  }

  const cities = LOCATIONS[countryCode].states[stateCode]?.cities ?? [];
  const cityCode = cities.includes(city) ? city : '';

  if (!cityCode && city) {
    return {
      country: 'OTHER',
      stateCode: '',
      cityCode: '',
      customState: state,
      customCity: city,
    };
  }

  return {
    country: countryCode,
    stateCode,
    cityCode,
    customState: '',
    customCity: '',
  };
}
