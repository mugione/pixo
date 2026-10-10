import { nowIso, sha256Hex } from './util'

/**
 * Fixed-window counter in D1. Returns false when `limit` is exceeded within `windowSec`.
 * Keys are hashed so raw IPs never reach the database.
 */
export async function rateLimit(db: D1Database, rawKey: string, salt: string, limit: number, windowSec: number): Promise<boolean> {
  const key = await sha256Hex(`${salt}:${rawKey}`)
  const now = nowIso()
  const reset = new Date(Date.now() + windowSec * 1000).toISOString()
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.reset_at <= ?3 THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= ?3 THEN ?2 ELSE rate_limits.reset_at END
       RETURNING count`,
    )
    .bind(key, reset, now)
    .first<{ count: number }>()
  return (row?.count ?? 0) <= limit
}

export const clientIp = (req: Request) => req.headers.get('CF-Connecting-IP') ?? 'unknown'
