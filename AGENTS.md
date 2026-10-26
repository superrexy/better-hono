# AGENTS.md

Hono + better-auth + Drizzle (better-drizzle) on Cloudflare Workers, run by Bun.
e2e tests call the app in-process against a real Postgres.

Rules below follow <https://hono.dev/docs/guides/best-practices> and the
conventions already in this repo. Read `README.md` for setup and API surface.

## Commands

```bash
bun run typecheck   # tsc --noEmit
bun test            # whole suite, concurrent
bun run test:e2e    # tests/e2e only
bun run dev         # wrangler dev
bun run db:push && bun run db:seed
```

## Hono rules

### 1. No "Rails-like" controllers

A handler must not be a free function that re-declares the context type and
reads `c.req.param()` by hand — the path param stops being inferred.

```ts
// ❌ path param is not inferred
const getUser = (c: Context) => c.json(c.req.param('id'))

// ✅ inline: inference works
router.get('/:id', (c) => c.json(c.req.param('id')))
```

### 2. Bind handlers to a route with `defineOpenAPIRoute()`

Every handler in `src/api/*/*.handler.ts` comes from `defineOpenAPIRoute()`
(`@hono/zod-openapi`), paired with the route object from the module's
`*.route.ts`. The guard chain and the request schemas live in that route object,
so `c.req.valid(...)` and `c.get('db')` are inferred from it. Never
`new Hono(...)`, never a second factory.

```ts
// users.handler.ts
export const getUser = defineOpenAPIRoute({
  route: getUserRoute, // guard + params schema, see users.route.ts
  handler: async (c) =>
    c.json(userSchema.parse(await service(c).get(c.req.valid("param").id)), 200),
});
```

Reading a path param with `c.req.param()` or declaring the context type by hand
gives up that inference — do not. When a route is not documented, fall back to
`factory.createHandlers(authorize(...), validate(...), handler)` and register it
with plain `router.get(...)`.

### 3. `*.route.ts` declares, `*.index.ts` only mounts

A `*.route.ts` holds `createRoute()` objects: method, path, `middleware` guards,
`request` schemas and responses. No database access, no business logic.

Index files mount and nothing else — no validation, no auth, no `await`.

```ts
const router = createRouter().openapiRoutes([listUsers, getUser, createUser])

export type UsersType = typeof router
export default router
```

`openapiRoutes()` registers the routes *and* their `createRoute()` definitions in
the OpenAPI registry, which is what puts the module in `/doc`.

### 4. Chain routes, keep the module type

Chained calls accumulate the route schema into `typeof router`. Registering
routes as separate statements (`router.get(...)` then `router.post(...)`) throws
that type away and breaks any `hc<AppType>()` client.

`src/app.ts` exports `AppType = ReturnType<typeof createServerApp>` for the
same reason: it stays chained so the type covers every mounted router.

### 5. Never add a HEAD route

Hono converts `HEAD` to `GET` before route matching and strips the body, so
`app.head(path, ...)` and `app.on('HEAD', path, ...)` are dead code. When HEAD
needs different behavior, do it in middleware after `await next()`. Assert
parity in tests instead:

```ts
const getRes = await app.request("/api/users");
const headRes = await app.request("/api/users", { method: "HEAD" });
expect(headRes.status).toBe(getRes.status);
expect(headRes.body).toBe(null);
```

### 6. Build larger apps with `app.route()`

One file set per resource under `src/api/<resource>/`, mounted in
`src/api/api.index.ts` via `createRouter().route('/users', users)`. Never import
one module's handler into another module.

## Layering

`schema → route → repository → service → handler → index`

| File | Responsibility |
| --- | --- |
| `*.schema.ts` | zod schemas for bodies, params and responses |
| `*.route.ts` | `createRoute()`: method, path, `middleware` guards, request/response schemas |
| `*.repository.ts` | database access only (better-drizzle delegates) |
| `*.service.ts` | business rules, throws `HTTPException` |
| `*.handler.ts` | `defineOpenAPIRoute({ route, handler })`, returns a response |
| `*.index.ts` | mounts, module type |

## OpenAPI and Scalar

`createRouter()` returns an `OpenAPIHono`, so `createRoute()` definitions are
collected into a registry. `src/lib/create-app.ts` sets `defaultHook`, which is
what makes a rejected `request` schema answer with the same
`{ message, issues }` 400 that `validate()` produces.

- `/doc` — the OpenAPI 3.1 document (`src/lib/openapi/document.ts`).
- `/reference` — Scalar UI rendering that document.
- better-auth's own document (`auth.api.generateOpenAPISchema()`) is merged in at
  request time: paths get the `/api/auth` prefix and its component schemas are
  namespaced `AuthUser`/`AuthSession`/… so they cannot shadow the app's.

Both routes are registered as plain `.get()`, deliberately outside the registry,
so the document never lists itself.

Response schemas are parsed (`userSchema.parse(row)`), not cast: better-drizzle
types an included relation as `{} | null`, so `parse` is what narrows it to the
documented shape and validates the payload on the way out. Use `z.date()` for
timestamps — it documents as `string`/`date-time` and accepts the `Date` the
service returns.

## Request context

- Read clients from the context: `c.get('db')`, `c.get('authApi')`.
- Never cache a runtime, db client or auth instance at module scope — Workers
  forbids reusing an I/O object across requests. Build per request; tests inject
  a shared pool through `createServerApp({ createRuntime })`.
- Read the caller through `principal(c)`; it throws 401 when no session exists.

## Errors and validation

- Throw `HTTPException` from services and handlers. `onError` renders the
  envelope; never hand-roll an error response.
- Validate input by declaring it on the route (`request.params` / `request.body`);
  `openAPIDefaultHook` renders the shared `{ message, issues }` 400 shape. For a
  route that stays on plain `router.get(...)`, use
  `validate('json' | 'param' | 'query', schema)` from `@/lib/validators` — it
  returns the same body.
- List endpoints read the raw query string and go through
  `src/utils/query-builder` (allowlisted filters/sorts/fields/includes). No zod
  schema for list queries.

## Types

- `AppBindings` (`src/lib/types.ts`) is the only Env. New binding → extend
  `Environment` (`src/env.ts`) and `AppBindings.Variables`.
- `@/*` maps to `src/*`. Use it instead of relative chains.
- Permissions and roles are declared in `src/lib/permissions.ts` as const
  tuples, so a typo in `authorize('users:raed')` fails at compile time. Run
  `bun run db:seed` after editing them.

## Tests

- Run on `bun test`; they call the app in-process through `tests/helpers/app.ts`.
- Every fixture gets a unique email (`uniqueEmail()`), and nothing is truncated
  between tests — scope assertions to the fixture the test created.
- Cover the guard, not just the happy path: 401 without a session, 403 without
  the permission, 400 on invalid input.
- Assert GET/HEAD parity for new routes.

## Adding an endpoint

1. `*.schema.ts` — zod schemas for body, params and responses (`.openapi('Name')`
   for a component).
2. `*.route.ts` — `createRoute()` with `middleware: [authorize(...)]` and the
   request/response schemas.
3. `*.repository.ts` — query only.
4. `*.service.ts` — rules, `HTTPException` on failure.
5. `*.handler.ts` — `defineOpenAPIRoute({ route, handler })`, response parsed
   through its schema.
6. `*.index.ts` — `createRouter().openapiRoutes([...])` in the same chain as the
   other routes, export `typeof router`.
7. `tests/e2e/*.test.ts` — happy path plus guard failures and HEAD parity.
8. `bun run typecheck && bun test`.
