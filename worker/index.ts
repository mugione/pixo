// Pixo AI Worker. Static pages are served by Workers Static Assets before this code runs;
// only /api/* requests reach the Worker (see `assets.run_worker_first` in wrangler.jsonc).
import { handleContact } from './contact'
import type { AppEnv } from './env'
import { error, json } from './http'

type Handler = (req: Request, env: AppEnv) => Promise<Response> | Response

const routes: Record<string, Partial<Record<string, Handler>>> = {
  '/api/health': {
    GET: (_req, env) => json({ status: 'ok', env: env.APP_ENV, db: Boolean(env.DB), time: new Date().toISOString() }),
  },
  '/api/public-config': {
    // Only values that are safe to expose publicly.
    GET: (_req, env) => json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || null }),
  },
  '/api/contact': {
    POST: (req, env) => handleContact(req, env),
  },
}

export default {
  async fetch(req: Request, env: AppEnv): Promise<Response> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)

    const route = routes[url.pathname.replace(/\/+$/, '')]
    if (!route) return error('not_found', 'Not found', 404)
    const handler = route[req.method]
    if (!handler) {
      return error('method_not_allowed', 'Method not allowed', 405, { headers: { Allow: Object.keys(route).join(', ') } })
    }
    try {
      return await handler(req, env)
    } catch (e) {
      // Log without request bodies / personal data.
      console.error('api_error', { path: url.pathname, method: req.method, message: e instanceof Error ? e.message : 'unknown' })
      return error('internal_error', 'Internal error', 500)
    }
  },
} satisfies ExportedHandler<AppEnv>
