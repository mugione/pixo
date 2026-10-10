export interface AppEnv {
  ASSETS: Fetcher
  DB?: D1Database
  AI?: Ai
  APP_ENV: string
  SITE_URL: string
  /** Comma-separated origins allowed to call state-changing APIs and to act as WebAuthn origins. */
  ALLOWED_ORIGINS?: string
  TURNSTILE_SITE_KEY?: string
  // Secrets (wrangler secret put …)
  TURNSTILE_SECRET_KEY?: string
  IP_HASH_SALT?: string
}
