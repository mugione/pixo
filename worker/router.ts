import type { AppEnv } from './env'
import { error } from './http'

export type Ctx = { req: Request; env: AppEnv; url: URL; params: Record<string, string> }
export type Handler = (ctx: Ctx) => Promise<Response> | Response

type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler }

/** Tiny router with `:param` segments. Unknown path → 404, known path/wrong method → 405. */
export class Router {
  private routes: Route[] = []

  on(method: string, path: string, handler: Handler): this {
    const keys: string[] = []
    const pattern = new RegExp(
      '^' +
        path.replace(/:(\w+)/g, (_, k: string) => {
          keys.push(k)
          return '([^/]+)'
        }) +
        '/?$',
    )
    this.routes.push({ method, pattern, keys, handler })
    return this
  }

  async handle(req: Request, env: AppEnv): Promise<Response> {
    const url = new URL(req.url)
    const matching = this.routes.filter((r) => r.pattern.test(url.pathname))
    if (!matching.length) return error('not_found', 'Not found', 404)
    const route = matching.find((r) => r.method === req.method)
    if (!route) {
      return error('method_not_allowed', 'Method not allowed', 405, { headers: { Allow: [...new Set(matching.map((r) => r.method))].join(', ') } })
    }
    const m = url.pathname.match(route.pattern)!
    const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]))
    return route.handler({ req, env, url, params })
  }
}
