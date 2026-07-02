import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';

const SESSION_KEY = '@mletras_connect_session';

export interface LocalSession {
  userId: string;
  hasCompletedProfile: boolean;
}

export async function getSession(): Promise<LocalSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as LocalSession;
}

export async function saveSession(session: LocalSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
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
