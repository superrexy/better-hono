import { $ } from '@hono/zod-openapi'
import createApp from '@/lib/create-app'
import type { CreateAppOptions } from '@/lib/create-app'
import { registerDocs } from '@/lib/openapi/document'
import api from '@/api/api.index'

/**
 * The full application: middleware from `createApp` plus every mounted router.
 *
 * Exported as a factory so tests can inject a shared runtime; the default
 * export below is what Wrangler serves.
 *
 * Routes are chained rather than added one statement at a time, so `AppType`
 * below carries every route and `hc<AppType>()` infers the client.
 */
export function createServerApp(options: CreateAppOptions = {}) {
  // `$` restores the `OpenAPIHono` type after `route()`, which Hono declares as
  // returning a plain `Hono`: without it the registry below is not reachable.
  const app = $(
    createApp(options)
      .get('/', (c) => c.json({ message: 'App API' }, 200))
      // Mounted under /api so better-auth's baseURL and the auth CORS rule line up.
      .route('/api', api),
  )

  // `/doc` and `/reference` are added last and registered outside the document
  // registry, so the API spec never lists the docs routes themselves.
  registerDocs(app)
  return app
}

/** The contract an RPC client types against. */
export type AppType = ReturnType<typeof createServerApp>

export default createServerApp()
