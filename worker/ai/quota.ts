// Atomic daily quotas. D1 serialises writes, so each conditional UPDATE is race-free:
// a request only proceeds if its own increment stayed within the limit.
import { fail } from '../http'
import type { SessionUser } from '../session'
import type { Settings } from '../settings'
import { nowIso, todayUtc, uuid } from '../util'

export type Kind = 'text' | 'image'

export type Reservation = { userId: string; kind: Kind; neurons: number; date: string }

export async function reserve(d: D1Database, user: SessionUser, s: Settings, kind: Kind): Promise<Reservation> {
  const date = todayUtc()
  const now = nowIso()
  const neurons = kind === 'text' ? s.text_neurons_estimate : s.image_neurons_estimate
  const limit = kind === 'text' ? (user.text_limit_override ?? s.user_daily_text_limit) : (user.image_limit_override ?? s.user_daily_image_limit)
  const col = kind === 'text' ? 'text_requests' : 'image_requests'

  const [, , userUpd] = await d.batch([
    d.prepare('INSERT OR IGNORE INTO usage_daily (id, user_id, usage_date_utc, updated_at) VALUES (?1, ?2, ?3, ?4)').bind(uuid(), user.id, date, now),
    d.prepare('INSERT OR IGNORE INTO global_usage_daily (usage_date_utc, updated_at) VALUES (?1, ?2)').bind(date, now),
    d
      .prepare(
        `UPDATE usage_daily SET ${col} = ${col} + 1, estimated_neurons = estimated_neurons + ?3, last_used_at = ?4, updated_at = ?4
          WHERE user_id = ?1 AND usage_date_utc = ?2 AND ${col} < ?5`,
      )
      .bind(user.id, date, neurons, now, limit),
  ])
  if (!userUpd.meta.changes) return fail('quota_exceeded', 'Daily AI quota reached', 429)

  const globalUpd = await d
    .prepare(
      `UPDATE global_usage_daily SET total_requests = total_requests + 1, estimated_neurons = estimated_neurons + ?2, updated_at = ?3
        WHERE usage_date_utc = ?1 AND estimated_neurons + ?2 <= ?4`,
    )
    .bind(date, neurons, now, s.global_daily_neuron_budget)
    .run()
  if (!globalUpd.meta.changes) {
    await refundUser(d, { userId: user.id, kind, neurons, date })
    return fail('system_quota_exceeded', 'AI service reached its daily capacity', 503)
  }
  return { userId: user.id, kind, neurons, date }
}

async function refundUser(d: D1Database, r: Reservation) {
  const col = r.kind === 'text' ? 'text_requests' : 'image_requests'
  await d
    .prepare(
      `UPDATE usage_daily SET ${col} = MAX(0, ${col} - 1), estimated_neurons = MAX(0, estimated_neurons - ?3), updated_at = ?4
        WHERE user_id = ?1 AND usage_date_utc = ?2`,
    )
    .bind(r.userId, r.date, r.neurons, nowIso())
    .run()
}

/** Gives the request back to both the user and the global budget (used when the AI call fails). */
export async function refund(d: D1Database, r: Reservation) {
  await refundUser(d, r)
  await d
    .prepare(
      `UPDATE global_usage_daily SET total_requests = MAX(0, total_requests - 1), estimated_neurons = MAX(0, estimated_neurons - ?2), updated_at = ?3
        WHERE usage_date_utc = ?1`,
    )
    .bind(r.date, r.neurons, nowIso())
    .run()
}
