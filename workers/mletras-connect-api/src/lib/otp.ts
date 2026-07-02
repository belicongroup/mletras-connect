export type OtpFlow = 'signup' | 'reset';

interface OtpRecord {
  code: string;
  attempts: number;
}

interface VerifiedRecord {
  verifiedAt: number;
}

const OTP_TTL_SECONDS = 60;
const VERIFIED_TTL_SECONDS = 900;
const MAX_ATTEMPTS = 5;

function otpKey(flow: OtpFlow, email: string): string {
  return `otp:${flow}:${email.toLowerCase()}`;
}

function verifiedKey(flow: OtpFlow, email: string): string {
  return `verified:${flow}:${email.toLowerCase()}`;
}

export function generateOtpCode(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return value.toString().padStart(6, '0');
}

export async function storeOtp(
  kv: KVNamespace,
  flow: OtpFlow,
  email: string,
  code: string,
): Promise<void> {
  const record: OtpRecord = { code, attempts: 0 };
  await kv.put(otpKey(flow, email), JSON.stringify(record), {
    expirationTtl: OTP_TTL_SECONDS,
  });
}

export async function verifyOtp(
  kv: KVNamespace,
  flow: OtpFlow,
  email: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = otpKey(flow, email);
  const raw = await kv.get(key);
  if (!raw) {
    return { ok: false, error: 'codeExpired' };
  }

  const record = JSON.parse(raw) as OtpRecord;
  if (record.attempts >= MAX_ATTEMPTS) {
    await kv.delete(key);
    return { ok: false, error: 'tooManyAttempts' };
  }

  if (record.code !== code) {
    record.attempts += 1;
    await kv.put(key, JSON.stringify(record), { expirationTtl: OTP_TTL_SECONDS });
    return { ok: false, error: 'invalidCode' };
  }

  await kv.delete(key);
  const verified: VerifiedRecord = { verifiedAt: Date.now() };
  await kv.put(verifiedKey(flow, email), JSON.stringify(verified), {
    expirationTtl: VERIFIED_TTL_SECONDS,
  });

  return { ok: true };
}

export async function consumeVerification(
  kv: KVNamespace,
  flow: OtpFlow,
  email: string,
): Promise<boolean> {
  const key = verifiedKey(flow, email);
  const raw = await kv.get(key);
  if (!raw) return false;
  await kv.delete(key);
  return true;
}
