export interface AppEnv {
  ASSETS: Fetcher
  DB?: D1Database
  APP_ENV: string
  SITE_URL: string
  TURNSTILE_SITE_KEY?: string
  // Secrets (wrangler secret put …)
  TURNSTILE_SECRET_KEY?: string
  IP_HASH_SALT?: string
}
