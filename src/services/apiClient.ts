import { API_URL } from '../config/api';
import { getToken } from './profileService';

export interface ApiResult<T> {
  ok: boolean;
  error?: string;
  data?: T;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    const body = (await response.json().catch(() => null)) as
      | ({ ok?: boolean; error?: string } & T)
      | null;

    if (!response.ok || !body?.ok) {
      return { ok: false, error: body?.error ?? 'unknown' };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: 'networkError' };
  }
}
