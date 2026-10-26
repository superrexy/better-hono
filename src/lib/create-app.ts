import { OpenAPIHono } from "@hono/zod-openapi";
import { requestId } from "hono/request-id";
import withAuth from "@/middlewares/with-auth";
import notFound from "@/middlewares/not-found";
import onError from "@/middlewares/on-error";
import authCors from "@/middlewares/auth-cors";
import { parseEnv } from "@/env";
import { openAPIDefaultHook } from "@/lib/openapi/hook";
import { createRuntime } from "@/lib/runtime";
import type { Runtime } from "@/lib/runtime";
import type { Environment } from "@/env";
import type { AppBindings } from "@/lib/types";

/**
 * An `OpenAPIHono` rather than a plain `Hono`: it collects the routes declared
 * with `createRoute()` into a registry, which is what `getOpenAPI31Document()`
 * turns into the document served at `/doc`.
 *
 * `defaultHook` makes a rejected `request` schema answer exactly like
 * `validate()` does (400 with `{ message, issues }`), for this router and for
 * every child router mounted on it.
 */
export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook: openAPIDefaultHook,
  });
}

export interface CreateAppOptions {
  /**
   * How a request obtains its database and auth clients. The default builds a
   * fresh runtime per request, which is required on Cloudflare Workers because
   * an I/O object cannot be reused across requests. Tests inject a memoised
   * version so the suite shares one connection pool.
   */
  createRuntime?: (env: Environment) => Runtime;
}

export default function createApp(options: CreateAppOptions = {}) {
  const runtimeFor = options.createRuntime ?? createRuntime;
  const app = createRouter();

  app.use((c, next) => {
    c.env = parseEnv(Object.assign(c.env || {}, process.env));
    return next();
  });

  app.use('*', async (c, next) => {
    const runtime = runtimeFor(c.env);
    c.set('db', runtime.db);
    c.set('authApi', runtime.auth);
    await next();
  });

  app.use(requestId());

  // Must run after the runtime is on the context: withAuth reads authApi.
  app.use('/api/auth/*', authCors);
  app.use('*', withAuth);

  app.onError(onError);
  app.notFound(notFound);
  return app;
}
