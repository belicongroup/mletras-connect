import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthLocale, AuthStrings, getAuthStrings } from '../constants/authStrings';

const LOCALE_KEY = '@mletras_connect_locale';

interface AuthLanguageContextValue {
  locale: AuthLocale;
  strings: AuthStrings;
  setLocale: (locale: AuthLocale) => void;
  toggleLocale: () => void;
  isReady: boolean;
}

const AuthLanguageContext = createContext<AuthLanguageContextValue | null>(null);

export function AuthLanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AuthLocale>('en');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadLocale() {
      try {
        const stored = await AsyncStorage.getItem(LOCALE_KEY);
        if (mounted && (stored === 'en' || stored === 'es')) {
          setLocaleState(stored);
        }
      } finally {
        if (mounted) setIsReady(true);
      }
    }

    loadLocale();
    return () => {
      mounted = false;
    };
  }, []);

  const setLocale = useCallback((next: AuthLocale) => {
    setLocaleState(next);
    void AsyncStorage.setItem(LOCALE_KEY, next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((current) => {
      const next = current === 'en' ? 'es' : 'en';
      void AsyncStorage.setItem(LOCALE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      locale,
      strings: getAuthStrings(locale),
      setLocale,
      toggleLocale,
      isReady,
    }),
    [locale, setLocale, toggleLocale, isReady],
  );

  return <AuthLanguageContext.Provider value={value}>{children}</AuthLanguageContext.Provider>;
}

export function useAuthLanguage(): AuthLanguageContextValue {
  const ctx = useContext(AuthLanguageContext);
  if (!ctx) throw new Error('useAuthLanguage must be used within AuthLanguageProvider');
  return ctx;
}
