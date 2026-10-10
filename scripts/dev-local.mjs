// Runs `wrangler dev` fully offline: same config as production minus the Workers AI binding
// (which always needs a Cloudflare account). AI endpoints then answer 503 "unavailable".
// Usage: node scripts/dev-local.mjs [extra wrangler args]
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const raw = readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8')
// Strip // comments (outside strings) and trailing commas to get plain JSON.
const json = raw
  .split('\n')
  .map((l) => l.replace(/^(\s*)\/\/.*$/, '$1').replace(/("(?:[^"\\]|\\.)*")|\s+\/\/.*$/g, (m, str) => str ?? ''))
  .join('\n')
  .replace(/,(\s*[}\]])/g, '$1')
const config = JSON.parse(json)
delete config.ai
const out = resolve(root, 'wrangler.local.json')
writeFileSync(out, JSON.stringify(config, null, 2))
const child = spawn('npx', ['wrangler', 'dev', '-c', out, ...process.argv.slice(2)], { stdio: 'inherit', cwd: root })
child.on('exit', (code) => process.exit(code ?? 0))
