export interface Env {
  DB: D1Database;
  OTP: KVNamespace;
  RESEND_API_KEY: string;
  JWT_SECRET: string;
  FROM_EMAIL: string;
}
