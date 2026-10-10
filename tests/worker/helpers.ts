// Real local D1 (Miniflare) for integration tests, without the remote-only Workers AI binding.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { getPlatformProxy } from 'wrangler'

export async function setupDb() {
  mkdirSync('.wrangler', { recursive: true })
  const configPath = `.wrangler/test-config-${crypto.randomUUID()}.json`
  writeFileSync(
    configPath,
    JSON.stringify({
      name: 'pixo-test',
      compatibility_date: '2026-09-01',
      d1_databases: [{ binding: 'DB', database_name: 'pixo-test', database_id: 'test' }],
    }),
  )
  const proxy = await getPlatformProxy({ configPath, persist: false })
  rmSync(configPath, { force: true })
  const db = (proxy.env as { DB: D1Database }).DB
  for (const file of readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(`migrations/${file}`, 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) await db.prepare(stmt).run()
  }
  return { proxy, db }
}
