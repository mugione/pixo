// System settings live in D1 so operators can change limits/kill-switches without a redeploy.

export type Settings = {
  ai_enabled: boolean
  registrations_enabled: boolean
  maintenance_mode: boolean
  user_daily_text_limit: number
  user_daily_image_limit: number
  global_daily_neuron_budget: number
  text_neurons_estimate: number
  image_neurons_estimate: number
  text_model: string
  image_model: string
  max_upload_mb: number
  announcement: string
}

export const DEFAULT_SETTINGS: Settings = {
  ai_enabled: true,
  registrations_enabled: true,
  maintenance_mode: false,
  user_daily_text_limit: 3,
  user_daily_image_limit: 1,
  global_daily_neuron_budget: 6000,
  text_neurons_estimate: 120,
  image_neurons_estimate: 400,
  text_model: '@cf/zai-org/glm-4.7-flash',
  image_model: '@cf/black-forest-labs/flux-2-klein-4b',
  max_upload_mb: 5,
  announcement: '',
}

export async function getSettings(db: D1Database): Promise<Settings> {
  const { results } = await db.prepare('SELECT key, value FROM system_settings').all<{ key: string; value: string }>()
  const s: Settings = { ...DEFAULT_SETTINGS }
  const target = s as unknown as Record<string, unknown>
  for (const { key, value } of results) {
    if (!(key in DEFAULT_SETTINGS)) continue
    const def = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[key]
    if (typeof def === 'boolean') target[key] = value === 'true'
    else if (typeof def === 'number') {
      const n = Number(value)
      if (Number.isFinite(n) && n >= 0) target[key] = n
    } else target[key] = value
  }
  return s
}
