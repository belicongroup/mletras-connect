export interface Env {
  DB: D1Database;
  OTP: KVNamespace;
  MEDIA: R2Bucket;
  RESEND_API_KEY: string;
  JWT_SECRET: string;
  FROM_EMAIL: string;
  /** When "true", enables isolated /__test__/* routes (never enable in production). */
  ENABLE_TEST_ROUTES?: string;

  // --- Media pipeline (all optional; absence falls back to raw R2 delivery) ---
  /** Cloudflare account id, shared by Images and Stream APIs. */
  CF_ACCOUNT_ID?: string;
  /** API token with Cloudflare Images edit permission. Enables the Images path. */
  CF_IMAGES_TOKEN?: string;
  /** Account image-delivery hash used to build imagedelivery.net URLs. */
  CF_IMAGES_HASH?: string;
  /** API token with Cloudflare Stream edit permission. Enables the video path. */
  CF_STREAM_TOKEN?: string;
  /** Customer subdomain code for Stream delivery (customer-<code>.cloudflarestream.com). */
  CF_STREAM_CUSTOMER_CODE?: string;
  /** Shared secret used to verify Stream webhook signatures. */
  CF_STREAM_WEBHOOK_SECRET?: string;
  /** Optional custom CDN origin for R2-served media, e.g. https://media.mletras.com. */
  MEDIA_CDN_URL?: string;
}
