# Better-Hono

### Hono + Better-Auth + Drizzle + Cloudflare Workers

A minimal template to kickstart projects with:

- **Hono** – Fast web framework
- **Better Auth** – Authentication system (email OTP + optional password)
- **RBAC** – Roles and permissions enforced by middleware
- **Drizzle ORM** – Database management
- **Cloudflare Workers** – Edge deployment
- **Bun** – Fast JavaScript runtime
- **Docker** – Local database development

Clean setup for authentication, database, and deployment.


## Getting Started

1. **Clone the repository:**

```bash
git clone https://github.com/alwaysnomads/better-hono.git
cd better-hono
```

2. **Install dependencies:**

```bash
bun install
```

3. **Setup your environment:**

```bash
# Copy the example environment file into .env and .dev.vars
cp .env.example .env .dev.vars
```

- **.env**: Used by your application (e.g., in Drizzle).
- **.dev.vars**: Used by Wrangler when running the local server.

> Edit both files with your environment variables.

4. **Start the database (if needed):**

```bash
# Start the local Postgres database with Docker
bun run docker:up
```

> Or connect to a cloud database like [Neon](https://neon.tech/).  
> Make sure your `.env` and `.dev.vars` point to the correct database URL.

5. **Push database schema, then seed roles and permissions:**

```bash
bun run db:push
bun run db:seed
bun run db:generate
```

`db:seed` mirrors `src/lib/permissions.ts` into the database and must run before
the first user is created, because `user.role_id` defaults to the `user` role.
It also creates the bootstrap admin when `SEED_ADMIN_PASSWORD` is set
(`SEED_ADMIN_EMAIL` defaults to `superadmin@example.com`). An email that already
exists is left untouched apart from its role, so the seed is safe to re-run:

```bash
SEED_ADMIN_PASSWORD=superadmin-12345678 bun run db:seed
# seeded 5 permission(s) and 2 role(s)
# admin created: superadmin@example.com
```

6. **Start the development server:**

```bash
bun run dev
```

> The development server runs on port **3000** by default for easier integration with Better-Auth, you can change it at the wrangler.jsonc file.
> The API reference is at [http://localhost:3000/reference](http://localhost:3000/reference) (Scalar), backed by the OpenAPI document at `/doc`. See [API reference](#api-reference).

## API reference

The document is generated from the same `createRoute()` objects the handlers run
on, so it cannot drift from the code:

| Path | What it serves |
| --- | --- |
| `GET /doc` | OpenAPI 3.1 JSON |
| `GET /reference` | Scalar UI rendering that document |

better-auth's own document is merged into the same one at request time — its
paths appear under `/api/auth`, and its component schemas are namespaced
(`AuthUser`, `AuthSession`, …) so they never shadow the app's `User`/`Role`.
That means one page covers both surfaces, and the session cookie set by a
sign-in call is reused by the guarded routes:

1. `POST /api/auth/sign-up/email` (or `POST /api/auth/sign-in/email` once the
   account exists), or the password-less pair
   `POST /api/auth/email-otp/send-verification-otp` →
   `POST /api/auth/sign-in/email-otp`.
2. The response sets a session cookie. The reference is served from the API
   origin, so the browser keeps it and sends it on later requests.
3. `GET /api/me` reports the principal; `GET /api/users` needs `users:read`.

In development the OTP is printed by the server instead of being emailed
(`[mail] to=… body=Your code is …`), so keep `bun run dev` visible while
testing the OTP flow.

better-auth also serves a reference of its own at `/api/auth/reference`;
`/reference` covers the same endpoints plus the app's, so that page is only
useful if you wanted auth-only docs.

Both routes are always on, including in production. Remove `registerDocs(app)`
from `src/app.ts` if you deploy the docs separately.


## Thanks to w3cj!

This template is heavily inspired by [w3cj's hono-open-api-starter](https://github.com/w3cj/hono-open-api-starter), even using parts of their code. Make sure to check out their repository!


## Available Commands

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `bun run dev`          | Start local server (Wrangler)        |
| `bun run deploy`       | Deploy to Cloudflare                 |
| `bun run cf-typegen`   | Generate Cloudflare types            |
| `bun run docker:up`    | Start Docker containers              |
| `bun run docker:down`  | Stop Docker containers               |
| `bun run docker:clean` | Stop and remove containers + volumes |
| `bun run db:push`      | Push schema to database              |
| `bun run db:generate`  | Generate Drizzle ORM types           |
| `bun run db:migrate`   | Run database migrations              |
| `bun run db:studio`    | Open Drizzle Studio GUI              |
| `bun run db:seed`      | Sync roles/permissions + create admin |
| `bun run test`         | Run the e2e suite concurrently        |
| `bun run test:e2e`     | Run only `tests/e2e`                  |
| `bun run test:watch`   | Watch mode for the e2e suite          |

## Configure template

### Adding New Bindings

To add Cloudflare bindings (e.g., R2 buckets, KV stores), update the bindings types at `src/lib/types.ts`


### Configure Auth

Authentication lives in `src/lib/auth.ts`. Two ways in:

- **Email OTP (password-less):** request a code with
  `POST /api/auth/email-otp/send-verification-otp`, then exchange it with
  `POST /api/auth/sign-in/email-otp`. The account is created on first verify.
- **Email + password:** `POST /api/auth/sign-up/email` and
  `POST /api/auth/sign-in/email`.

In development the OTP is printed to the server console as
`[mail] to=... body=Your code is ...`. Set `RESEND_API_KEY` to send real email
through Resend; `sendMail` in `src/lib/mailer.ts` is the only place to change.

## Access control (RBAC)

One user holds exactly one role. A role holds many permissions, and the same
permission can belong to several roles.

```
user.role_id -> role -> role_permission -> permission
```

Permissions and roles are declared in code, in `src/lib/permissions.ts`, then
mirrored into the database by `bun run db:seed`. Nothing creates a role or
permission over the API.

The one account the seed creates is the bootstrap admin: `SEED_ADMIN_EMAIL`
(`superadmin@example.com` by default) with the password from
`SEED_ADMIN_PASSWORD`. Registration goes through better-auth, so the `account`
row holds a real hash; leave the password empty and no admin is created.

```ts
// src/lib/permissions.ts
export const PERMISSIONS = ['users:read', 'users:create'] as const;

export const ROLES = {
  admin: { name: 'Administrator', description: '...', permissions: PERMISSIONS },
  user: { name: 'User', description: '...', permissions: ['users:read'] },
} as const satisfies Record<string, RoleDefinition>;
```

`PERMISSIONS` is a const tuple, so `Permission` is a union of string literals: a
typo in `authorize('users:raed')` fails at compile time. Prefer it over a TS
`enum`, which adds a runtime object and narrows less cleanly.

After editing, run `bun run db:seed` to sync the tables.

### Protecting a route

`withAuth` runs on every request and puts the resolved principal on the context.
`authorize` takes one or more permissions and passes when the role grants **any**
of them; no session gives `401`, a role without the permission gives `403`.

```ts
import { createRoute } from '@hono/zod-openapi';
import { authorize } from '@/middlewares/authorize';
import { userIdParam } from '@/api/users/users.schema';

export const getUserRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Users'],
  middleware: [authorize('users:read')],
  request: { params: userIdParam },
  responses: { 200: { /* … */ }, 404: { /* … */ } },
});
```

`requireSession()` is `authorize()` with no permission, for routes that only need
a logged-in user.

### API layout

Each module in `src/api/` splits into schema -> route -> repository -> service ->
handler -> index:

| File | Responsibility |
| --- | --- |
| `*.schema.ts` | zod schemas for bodies, params and responses |
| `*.route.ts` | `createRoute()`: method, path, guards, request/response schemas |
| `*.repository.ts` | database access only (better-drizzle delegates) |
| `*.service.ts` | business rules, throws `HTTPException` |
| `*.handler.ts` | `defineOpenAPIRoute({ route, handler })` |
| `*.index.ts` | `createRouter().openapiRoutes([...])`, exports `typeof router` |

The guard chain lives on the route (`middleware: [authorize('users:read')]`), so
the handler's context — `c.get('db')`, `c.req.valid('param')` — is inferred from
the route object instead of being hand-declared. A rejected `request` schema
answers with the same `{ message, issues }` 400 that `validate()` produces,
because `createRouter()` installs that hook. Route registration is chained, which
keeps the route schema in `typeof router`; `src/app.ts` exports `AppType` so an
`hc<AppType>()` client types itself.

HEAD needs no route: Hono answers it from the matching GET route and strips the
body. `tests/e2e/health.test.ts` asserts that GET/HEAD agree.

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/me` | session |
| GET | `/api/users` | `users:read` |
| GET | `/api/users/:id` | `users:read` |
| POST | `/api/users` | `users:create` |
| PATCH | `/api/users/:id` | `users:update` |
| DELETE | `/api/users/:id` | `users:delete` |
| GET | `/api/roles` | `roles:read` |
| GET | `/api/roles/:id` | `roles:read` |

### List endpoints (query builder)

`GET /api/users` is served by `src/utils/query-builder`, a spatie-style query
builder over better-drizzle delegates. The route hands the raw query string to
the builder, which validates it against a per-resource allowlist, so no zod
schema is used for lists.

```http
/api/users?filter[roleId][eq]=admin&filter[or][email]=a@b.c&filter[or][name]=ann
           &sort=-createdAt,email&fields=id,email&include=role&page=2&perPage=20
```

- `filter[column]=value`, `filter[column]=a,b` (IN), `filter[column][operator]=value`
- `filter[or][column]=value` groups as OR, ANDed with the other filters
- `sort=-createdAt,email` (`-` = descending), `fields=id,email`, `include=role`
- `page` / `perPage` (default 20, max 100)

Operators are derived from the column type, and any column, sort, field or
relation outside the allowlist answers 400. See
[`src/utils/query-builder/README.md`](src/utils/query-builder/README.md) for the
full syntax and how to add a new list resource.

### Bootstrapping the first admin

OTP sign-in creates accounts with the default `user` role, so promote yourself
once after your first login:

```bash
docker exec app_db psql -U postgres -d postgres \
  -c "update \"user\" set role_id='admin' where email='you@example.com';"
```

Creating a user with `POST /api/users` and no `password` produces a password-less
account: the only way in is an emailed OTP.

## End-to-end tests

Tests live in `tests/`, run on `bun test`, and talk to their own database.

```bash
bun run test          # entire suite, tests run concurrently
bun run test:e2e      # same, scoped to tests/e2e
bun run test:watch    # re-run on change
```

`tests/setup.ts` is preloaded through `bunfig.toml` and, once per run, creates
`app_test` if missing, applies `src/db/migrations`, and seeds the RBAC tables.
Tests call the app in-process (`app.request`), so no server or Wrangler is
involved.

The database name must end in `_test`; `tests/helpers/db.ts` refuses anything
else, so a mistyped `TEST_DATABASE_URL` cannot wipe a real database. Point it
elsewhere with `TEST_DATABASE_URL`.

### Why the suite is safe to run concurrently

`--concurrent` runs tests inside each file in parallel. That only holds if tests
share no state, so:

- every fixture gets a unique email (`uniqueEmail()`), and assertions are scoped
  to that fixture — nothing is truncated between tests;
- roles and permissions are reference data, seeded once and only read;
- the whole run shares one connection pool, because `createServerApp` accepts an
  injected runtime (`tests/helpers/app.ts`). Production still builds one runtime
  per request, which Cloudflare Workers require.

Measured on this suite (29 tests, 8 cores): 5.9s sequentially, 1.8s with
`--concurrent`. `--parallel` (one worker per core, `bun run test:e2e:parallel`)
is slower here because each worker repeats the database setup; it pays off only
for large suites.

## License

Released under the [MIT License](LICENSE).

---

✅ Built with **Bun**  
✅ Powered by **Cloudflare Workers**  
✅ Local database ready with **Docker**


