export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  tv?: number;
  exp: number;
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data),
  );
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

async function verify(data: string, signature: string, secret: string): Promise<boolean> {
  const expected = await sign(data, secret);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export async function createToken(
  payload: Omit<JwtPayload, 'exp'>,
  secret: string,
  ttlSeconds = 60 * 60 * 24 * 30,
): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    }),
  );
  const data = `${header}.${body}`;
  const signature = await sign(data, secret);
  return `${data}.${signature}`;
}

export async function verifyToken(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const valid = await verify(`${header}.${body}`, signature, secret);
  if (!valid) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}
