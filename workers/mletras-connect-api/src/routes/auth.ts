import { errorResponse, jsonResponse } from '../lib/cors';
import { sendOtpEmail } from '../lib/email';
import { createToken, getBearerToken, verifyToken } from '../lib/jwt';
import {
  consumeVerification,
  generateOtpCode,
  storeOtp,
  verifyOtp,
  type OtpFlow,
} from '../lib/otp';
import { hashPassword, verifyPassword } from '../lib/password';

export interface Env {
  DB: D1Database;
  OTP: KVNamespace;
  RESEND_API_KEY: string;
  JWT_SECRET: string;
  FROM_EMAIL: string;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  country: string;
  state: string;
  city: string;
  instruments: string;
  created_at: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createId(): string {
  return crypto.randomUUID();
}

function serializeUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    country: row.country,
    state: row.state,
    city: row.city,
    instruments: JSON.parse(row.instruments) as string[],
    createdAt: row.created_at,
  };
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function handleAuthRequest(
  request: Request,
  env: Env,
  path: string,
): Promise<Response | null> {
  if (path === '/auth/otp/send' && request.method === 'POST') {
    const body = await readJson<{ email?: string; flow?: OtpFlow }>(request);
    const email = body?.email ? normalizeEmail(body.email) : '';
    const flow: OtpFlow = body?.flow === 'reset' ? 'reset' : 'signup';

    if (!EMAIL_REGEX.test(email)) {
      return errorResponse(request, 'emailInvalid');
    }

    if (flow === 'signup') {
      const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
        .bind(email)
        .first();
      if (existing) {
        return errorResponse(request, 'emailTaken');
      }
    } else {
      const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
        .bind(email)
        .first();
      if (!existing) {
        return errorResponse(request, 'accountNotFound');
      }
    }

    const code = generateOtpCode();
    await storeOtp(env.OTP, flow, email, code);

    const sent = await sendOtpEmail(env.RESEND_API_KEY, env.FROM_EMAIL, email, code, flow);
    if (!sent.ok) {
      return errorResponse(request, sent.error, 502);
    }

    return jsonResponse(request, { ok: true });
  }

  if (path === '/auth/otp/verify' && request.method === 'POST') {
    const body = await readJson<{ email?: string; code?: string; flow?: OtpFlow }>(request);
    const email = body?.email ? normalizeEmail(body.email) : '';
    const code = body?.code?.trim() ?? '';
    const flow: OtpFlow = body?.flow === 'reset' ? 'reset' : 'signup';

    if (!EMAIL_REGEX.test(email)) {
      return errorResponse(request, 'emailInvalid');
    }
    if (!/^\d{6}$/.test(code)) {
      return errorResponse(request, 'invalidCode');
    }

    const result = await verifyOtp(env.OTP, flow, email, code);
    if (!result.ok) {
      return errorResponse(request, result.error);
    }

    return jsonResponse(request, { ok: true });
  }

  if (path === '/auth/signup' && request.method === 'POST') {
    const body = await readJson<{
      email?: string;
      password?: string;
      username?: string;
      firstName?: string;
      lastName?: string;
      country?: string;
      state?: string;
      city?: string;
      instruments?: string[];
    }>(request);

    const email = body?.email ? normalizeEmail(body.email) : '';
    const password = body?.password ?? '';
    const username = body?.username?.trim() ?? '';

    if (!EMAIL_REGEX.test(email)) {
      return errorResponse(request, 'emailInvalid');
    }
    if (password.length < 8) {
      return errorResponse(request, 'passwordInvalid');
    }
    if (!username) {
      return errorResponse(request, 'usernameRequired');
    }
    if (!body?.country?.trim() || !body?.state?.trim() || !body?.city?.trim()) {
      return errorResponse(request, 'locationRequired');
    }
    if (!body?.instruments?.length) {
      return errorResponse(request, 'instrumentsRequired');
    }

    const verified = await consumeVerification(env.OTP, 'signup', email);
    if (!verified) {
      return errorResponse(request, 'otpNotVerified');
    }

    const emailTaken = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first();
    if (emailTaken) {
      return errorResponse(request, 'emailTaken');
    }

    const usernameTaken = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
      .bind(username)
      .first();
    if (usernameTaken) {
      return errorResponse(request, 'usernameTaken');
    }

    const passwordHash = await hashPassword(password);
    const id = createId();
    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO users (
        id, email, password_hash, username, first_name, last_name,
        country, state, city, instruments, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        email,
        passwordHash,
        username,
        body.firstName?.trim() || null,
        body.lastName?.trim() || null,
        body.country.trim(),
        body.state.trim(),
        body.city.trim(),
        JSON.stringify(body.instruments),
        createdAt,
      )
      .run();

    const token = await createToken(
      { sub: id, email, username },
      env.JWT_SECRET,
    );

    return jsonResponse(request, {
      ok: true,
      token,
      user: {
        id,
        email,
        username,
        firstName: body.firstName?.trim() || undefined,
        lastName: body.lastName?.trim() || undefined,
        country: body.country.trim(),
        state: body.state.trim(),
        city: body.city.trim(),
        instruments: body.instruments,
        createdAt,
      },
    });
  }

  if (path === '/auth/login' && request.method === 'POST') {
    const body = await readJson<{ email?: string; password?: string }>(request);
    const email = body?.email ? normalizeEmail(body.email) : '';
    const password = body?.password ?? '';

    if (!EMAIL_REGEX.test(email) || !password) {
      return errorResponse(request, 'invalidCredentials');
    }

    const row = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first<UserRow>();
    if (!row) {
      return errorResponse(request, 'invalidCredentials');
    }

    const valid = await verifyPassword(password, row.password_hash);
    if (!valid) {
      return errorResponse(request, 'invalidCredentials');
    }

    const token = await createToken(
      { sub: row.id, email: row.email, username: row.username },
      env.JWT_SECRET,
    );

    return jsonResponse(request, {
      ok: true,
      token,
      user: serializeUser(row),
    });
  }

  if (path === '/auth/password/reset' && request.method === 'POST') {
    const body = await readJson<{ email?: string; password?: string }>(request);
    const email = body?.email ? normalizeEmail(body.email) : '';
    const password = body?.password ?? '';

    if (!EMAIL_REGEX.test(email)) {
      return errorResponse(request, 'emailInvalid');
    }
    if (password.length < 8) {
      return errorResponse(request, 'passwordInvalid');
    }

    const verified = await consumeVerification(env.OTP, 'reset', email);
    if (!verified) {
      return errorResponse(request, 'otpNotVerified');
    }

    const row = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string }>();
    if (!row) {
      return errorResponse(request, 'accountNotFound');
    }

    const passwordHash = await hashPassword(password);
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .bind(passwordHash, row.id)
      .run();

    return jsonResponse(request, { ok: true });
  }

  if (path === '/auth/me' && request.method === 'GET') {
    const token = getBearerToken(request);
    if (!token) {
      return errorResponse(request, 'unauthorized', 401);
    }

    const payload = await verifyToken(token, env.JWT_SECRET);
    if (!payload) {
      return errorResponse(request, 'unauthorized', 401);
    }

    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(payload.sub)
      .first<UserRow>();
    if (!row) {
      return errorResponse(request, 'unauthorized', 401);
    }

    return jsonResponse(request, { ok: true, user: serializeUser(row) });
  }

  if (path === '/auth/logout' && request.method === 'POST') {
    return jsonResponse(request, { ok: true });
  }

  return null;
}
