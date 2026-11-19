import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { UserProfile } from '../types';

const SESSION_KEY = '@mletras_connect_session';
const USER_CACHE_KEY = '@mletras_connect_user_cache';
// SecureStore keys allow only alphanumerics, '.', '-', and '_'.
const TOKEN_KEY = 'mletras_connect_token';
const isWeb = Platform.OS === 'web';

export interface LocalSession {
  userId: string;
  token: string;
  hasCompletedProfile: boolean;
}

interface SessionMeta {
  userId: string;
  hasCompletedProfile: boolean;
  token?: string;
}

async function setNativeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function deleteTokenValue(): Promise<void> {
  try {
    if (isWeb) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Deleting a missing key is a no-op we can safely ignore.
  }
}

async function readNativeToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getToken(): Promise<string | null> {
  const session = await getSession();
  return session?.token ?? null;
}

export async function getSession(): Promise<LocalSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  let parsed: SessionMeta;
  try {
    parsed = JSON.parse(raw) as SessionMeta;
  } catch {
    return null;
  }

  if (!parsed.userId) return null;

  // Web: keep the full session (including token) in one localStorage entry so
  // refresh reliably restores login state in the browser.
  if (isWeb) {
    if (typeof parsed.token !== 'string') {
      const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (!legacyToken) return null;
      const session: LocalSession = {
        userId: parsed.userId,
        token: legacyToken,
        hasCompletedProfile: parsed.hasCompletedProfile ?? true,
      };
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
      await AsyncStorage.removeItem(TOKEN_KEY);
      return session;
    }

    return {
      userId: parsed.userId,
      token: parsed.token,
      hasCompletedProfile: parsed.hasCompletedProfile ?? true,
    };
  }

  let token = await readNativeToken();
  if (!token && typeof parsed.token === 'string') {
    token = parsed.token;
    await setNativeToken(token);
  }
  if (!token) return null;

  return {
    userId: parsed.userId,
    token,
    hasCompletedProfile: parsed.hasCompletedProfile ?? true,
  };
}

export async function saveSession(session: LocalSession): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return;
  }

  const meta: SessionMeta = {
    userId: session.userId,
    hasCompletedProfile: session.hasCompletedProfile,
  };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(meta));
  await setNativeToken(session.token);
}

export async function saveCachedUser(user: UserProfile): Promise<void> {
  await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

export async function getCachedUser(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([SESSION_KEY, USER_CACHE_KEY]);
  await deleteTokenValue();
}

export function buildProfileSummary(user: UserProfile) {
  return {
    username: user.username,
    location: `${user.city}, ${user.state}`,
    instruments: user.instruments.join(' · '),
    memberSince: new Date(user.createdAt).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    }),
  };
}
