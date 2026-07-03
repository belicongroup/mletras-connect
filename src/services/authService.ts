import { Instrument, UserProfile } from '../types';
import { API_URL } from '../config/api';
import { getToken } from './profileService';

export type AuthFlow = 'signup' | 'reset';

export type AuthErrorCode =
  | 'emailInvalid'
  | 'emailTaken'
  | 'accountNotFound'
  | 'invalidCredentials'
  | 'invalidCode'
  | 'codeExpired'
  | 'tooManyAttempts'
  | 'otpNotVerified'
  | 'passwordInvalid'
  | 'usernameRequired'
  | 'usernameTaken'
  | 'locationRequired'
  | 'instrumentsRequired'
  | 'emailSendFailed'
  | 'networkError'
  | 'unauthorized'
  | 'unknown';

interface ApiResult<T> {
  ok: boolean;
  error?: AuthErrorCode;
  data?: T;
}

interface ApiUser {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  country: string;
  state: string;
  city: string;
  instruments: Instrument[];
  createdAt: string;
}

function mapUser(user: ApiUser): UserProfile {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    country: user.country,
    state: user.state,
    city: user.city,
    instruments: user.instruments,
    createdAt: user.createdAt,
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = false,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    const body = (await response.json().catch(() => null)) as
      | ({ ok?: boolean; error?: string } & T)
      | null;

    if (!response.ok || !body?.ok) {
      return {
        ok: false,
        error: (body?.error as AuthErrorCode | undefined) ?? 'unknown',
      };
    }

    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: 'networkError' };
  }
}

export async function sendOtp(
  email: string,
  flow: AuthFlow,
): Promise<ApiResult<void>> {
  return request('/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ email, flow }),
  });
}

export async function verifyOtp(
  email: string,
  code: string,
  flow: AuthFlow,
): Promise<ApiResult<void>> {
  return request('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code, flow }),
  });
}

export interface SignUpInput {
  email: string;
  password: string;
  username: string;
  firstName?: string;
  lastName?: string;
  country: string;
  state: string;
  city: string;
  instruments: Instrument[];
}

export async function signUp(
  input: SignUpInput,
): Promise<ApiResult<{ token: string; user: UserProfile }>> {
  const result = await request<{ token: string; user: ApiUser }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!result.ok || !result.data) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    data: {
      token: result.data.token,
      user: mapUser(result.data.user),
    },
  };
}

export async function login(
  email: string,
  password: string,
): Promise<ApiResult<{ token: string; user: UserProfile }>> {
  const result = await request<{ token: string; user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (!result.ok || !result.data) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    data: {
      token: result.data.token,
      user: mapUser(result.data.user),
    },
  };
}

export async function resetPassword(
  email: string,
  password: string,
): Promise<ApiResult<void>> {
  return request('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  country: string;
  state: string;
  city: string;
  instruments: Instrument[];
}

export async function updateProfile(
  input: UpdateProfileInput,
): Promise<ApiResult<UserProfile>> {
  const result = await request<{ user: ApiUser }>(
    '/users/me',
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
    true,
  );

  if (!result.ok || !result.data) {
    return { ok: false, error: result.error };
  }

  return { ok: true, data: mapUser(result.data.user) };
}

export async function getCurrentUser(): Promise<ApiResult<UserProfile>> {
  const result = await request<{ user: ApiUser }>('/auth/me', { method: 'GET' }, true);

  if (!result.ok || !result.data) {
    return { ok: false, error: result.error };
  }

  return { ok: true, data: mapUser(result.data.user) };
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' }, true);
}

export function mapAuthError(
  code: AuthErrorCode | undefined,
  strings: {
    emailInvalid: string;
    accountNotFound: string;
    signInFailed: string;
    usernameTaken: string;
    createAccountFailed: string;
    codeRequired: string;
    passwordMismatch: string;
  },
): string {
  switch (code) {
    case 'emailInvalid':
      return strings.emailInvalid;
    case 'emailTaken':
    case 'usernameTaken':
      return strings.usernameTaken;
    case 'accountNotFound':
      return strings.accountNotFound;
    case 'invalidCredentials':
      return strings.signInFailed;
    case 'invalidCode':
    case 'codeExpired':
    case 'tooManyAttempts':
    case 'otpNotVerified':
      return strings.codeRequired;
    case 'passwordInvalid':
      return strings.passwordMismatch;
    case 'networkError':
      return strings.signInFailed;
    default:
      return strings.createAccountFailed;
  }
}
