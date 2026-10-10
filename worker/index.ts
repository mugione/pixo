// Pixo AI Worker. Public pages are served by Workers Static Assets before this code runs;
// only /api/* and the signed-in app (/app, /admin) reach the Worker (see `run_worker_first`).
import { handleContact } from './contact'
import type { AppEnv } from './env'
import { error, HttpError, json, sameOrigin } from './http'
import { Router } from './router'
import { registerAiRoutes } from './routes/ai'
import { registerAuthRoutes } from './routes/auth'
import { registerWorkspaceRoutes } from './routes/workspace'
import { currentUser } from './session'

const router = new Router()
  .on('GET', '/api/health', ({ env }) =>
    json({ status: 'ok', env: env.APP_ENV, db: Boolean(env.DB), ai: Boolean(env.AI), time: new Date().toISOString() }),
  )
  // Only values that are safe to expose publicly.
  .on('GET', '/api/public-config', ({ env }) => json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || null }))
  .on('POST', '/api/contact', ({ req, env }) => handleContact(req, env))
registerAuthRoutes(router)
registerWorkspaceRoutes(router)
registerAiRoutes(router)

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

async function handleApi(req: Request, env: AppEnv): Promise<Response> {
  if (UNSAFE.has(req.method) && !sameOrigin(req, env)) return error('forbidden', 'Cross-origin request rejected', 403)
  try {
    return await router.handle(req, env)
  } catch (e) {
    if (e instanceof HttpError) return e.res
    // Log without request bodies / personal data.
    console.error('api_error', { path: new URL(req.url).pathname, method: req.method, message: e instanceof Error ? e.message : 'unknown' })
    return error('internal_error', 'Internal error', 500)
  }
}

/** Serves the single app shell for every /app/* route; signed-out visitors go to /login. */
async function handleApp(req: Request, env: AppEnv, url: URL): Promise<Response> {
  const user = await currentUser({ req, env, url, params: {} }).catch(() => null)
  if (!user || user.status !== 'active') {
    return Response.redirect(`${url.origin}/login?next=${encodeURIComponent(url.pathname + url.search)}`, 302)
  }
  const shell = await env.ASSETS.fetch(new Request(`${url.origin}/app`, req))
  const res = new Response(shell.body, shell)
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export default {
  async fetch(req: Request, env: AppEnv): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/api/')) return handleApi(req, env)
    if (url.pathname === '/app' || url.pathname.startsWith('/app/')) return handleApp(req, env, url)
    return env.ASSETS.fetch(req)
  },
} satisfies ExportedHandler<AppEnv>
