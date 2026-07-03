import { requireAuth, revokeToken } from '../lib/auth';
import { errorResponse, jsonResponse } from '../lib/cors';
import { sendOtpEmail } from '../lib/email';
import type { Env } from '../lib/env';
import { createToken, getBearerToken, verifyToken } from '../lib/jwt';
import {
  consumeVerification,
  generateOtpCode,
  storeOtp,
  verifyOtp,
  type OtpFlow,
} from '../lib/otp';
import { hashPassword, verifyPassword } from '../lib/password';
import { enforceRateLimit, getClientIp } from '../lib/rateLimit';
import { serializeUser, type UserRow } from '../lib/user';

export type { Env };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createId(): string {
  return crypto.randomUUID();
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

    const ip = getClientIp(request);
    const ipLimited = await enforceRateLimit(request, env.OTP, `otp:ip:${ip}`, 20, 900);
    if (ipLimited) return ipLimited;
    const emailLimited = await enforceRateLimit(request, env.OTP, `otp:email:${email}`, 5, 900);
    if (emailLimited) return emailLimited;

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

    const verifyLimited = await enforceRateLimit(
      request,
      env.OTP,
      `otpverify:ip:${getClientIp(request)}`,
      30,
      900,
    );
    if (verifyLimited) return verifyLimited;

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

    const signupLimited = await enforceRateLimit(
      request,
      env.OTP,
      `signup:ip:${getClientIp(request)}`,
      10,
      3600,
    );
    if (signupLimited) return signupLimited;

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

    try {
      await env.DB.prepare(
        `INSERT INTO users (
          id, email, password_hash, username, first_name, last_name,
          country, state, city, instruments, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          createdAt,
        )
        .run();
    } catch {
      // UNIQUE constraint race (concurrent signups sharing one verification).
      // Re-check which field collided so the client gets a precise error.
      const dupUsername = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
        .bind(username)
        .first();
      return errorResponse(request, dupUsername ? 'usernameTaken' : 'emailTaken');
    }

    const token = await createToken(
      { sub: id, email, username, tv: 0 },
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

    const ip = getClientIp(request);
    const ipLimited = await enforceRateLimit(request, env.OTP, `login:ip:${ip}`, 30, 900);
    if (ipLimited) return ipLimited;
    const emailLimited = await enforceRateLimit(request, env.OTP, `login:email:${email}`, 10, 900);
    if (emailLimited) return emailLimited;

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
      {
        sub: row.id,
        email: row.email,
        username: row.username,
        tv: row.token_version ?? 0,
      },
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
    // Bump token_version to invalidate every previously issued JWT.
    await env.DB.prepare(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?',
    )
      .bind(passwordHash, new Date().toISOString(), row.id)
      .run();

    return jsonResponse(request, { ok: true });
  }

  if (path === '/auth/me' && request.method === 'GET') {
    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(auth.payload.sub)
      .first<UserRow>();
    if (!row) {
      return errorResponse(request, 'unauthorized', 401);
    }
    if ((auth.payload.tv ?? 0) !== (row.token_version ?? 0)) {
      return errorResponse(request, 'unauthorized', 401);
    }

    return jsonResponse(request, { ok: true, user: serializeUser(row) });
  }

  if (path === '/auth/logout' && request.method === 'POST') {
    // Revoke the presented token so it can no longer be used, even though it
    // remains cryptographically valid until expiry.
    const token = getBearerToken(request);
    if (token) {
      const payload = await verifyToken(token, env.JWT_SECRET);
      if (payload) {
        await revokeToken(env.OTP, token, payload.exp);
      }
    }
    return jsonResponse(request, { ok: true });
  }

  return null;
}
