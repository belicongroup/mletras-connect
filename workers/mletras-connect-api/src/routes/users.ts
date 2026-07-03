import { requireAuth } from '../lib/auth';
import { errorResponse, jsonResponse } from '../lib/cors';
import type { Env } from '../lib/env';
import { INSTRUMENTS, serializeUser, type UserRow } from '../lib/user';

interface UpdateProfileBody {
  firstName?: string;
  lastName?: string;
  country?: string;
  state?: string;
  city?: string;
  instruments?: string[];
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function handleUsersRequest(
  request: Request,
  env: Env,
  path: string,
): Promise<Response | null> {
  if (path === '/users/me' && request.method === 'PATCH') {
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

    const body = await readJson<UpdateProfileBody>(request);
    if (!body) {
      return errorResponse(request, 'invalidRequest');
    }

    const country = body.country?.trim() ?? '';
    const state = body.state?.trim() ?? '';
    const city = body.city?.trim() ?? '';
    if (!country || !state || !city) {
      return errorResponse(request, 'locationRequired');
    }

    const instruments = body.instruments ?? [];
    if (!Array.isArray(instruments) || instruments.length === 0) {
      return errorResponse(request, 'instrumentsRequired');
    }
    if (!instruments.every((i) => INSTRUMENTS.has(i))) {
      return errorResponse(request, 'instrumentsRequired');
    }

    const firstName = body.firstName?.trim() || null;
    const lastName = body.lastName?.trim() || null;
    const updatedAt = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE users SET
        first_name = ?, last_name = ?, country = ?, state = ?, city = ?,
        instruments = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(
        firstName,
        lastName,
        country,
        state,
        city,
        JSON.stringify(instruments),
        updatedAt,
        row.id,
      )
      .run();

    const updated: UserRow = {
      ...row,
      first_name: firstName,
      last_name: lastName,
      country,
      state,
      city,
      instruments: JSON.stringify(instruments),
      updated_at: updatedAt,
    };

    return jsonResponse(request, { ok: true, user: serializeUser(updated) });
  }

  return null;
}
