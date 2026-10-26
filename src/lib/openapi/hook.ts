import type { Hook } from "@hono/zod-openapi";
import type { AppBindings } from "@/lib/types";
import { validationErrorBody } from "@/lib/validators";

/**
 * Attached to every `OpenAPIHono`/`OpenAPIHono`-backed router through
 * `createRouter()`, so a `createRoute()` request schema and `validate()` fail
 * the same way: 400 with the shared `{ message, issues }` envelope.
 *
 * The hook is inherited by child routers mounted with `app.route()`, so route
 * modules never set it themselves.
 */
export const openAPIDefaultHook: Hook<unknown, AppBindings, string, Response | void> = (
  result,
  c,
) => {
  if (result.success) return;

  return c.json(validationErrorBody(result.error.issues), 400);
};
