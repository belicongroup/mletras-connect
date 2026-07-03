export interface Env {
  DB: D1Database;
  OTP: KVNamespace;
  MEDIA: R2Bucket;
  RESEND_API_KEY: string;
  JWT_SECRET: string;
  FROM_EMAIL: string;
}
