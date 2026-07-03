import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { UserProfile } from '../types';

const SESSION_KEY = '@mletras_connect_session';
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
}

async function setTokenValue(token: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return;
  }
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

export async function getToken(): Promise<string | null> {
  try {
    if (isWeb) {
      return await AsyncStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getSession(): Promise<LocalSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  const meta = JSON.parse(raw) as SessionMeta;
  const token = await getToken();
  if (!token) return null;

  return { userId: meta.userId, hasCompletedProfile: meta.hasCompletedProfile, token };
}

export async function saveSession(session: LocalSession): Promise<void> {
  const meta: SessionMeta = {
    userId: session.userId,
    hasCompletedProfile: session.hasCompletedProfile,
  };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(meta));
  await setTokenValue(session.token);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
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
