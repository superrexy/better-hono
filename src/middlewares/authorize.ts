import { HTTPException } from "hono/http-exception";
import { createMiddleware } from "hono/factory";
import type { Permission } from "@/lib/permissions";
import type { AppBindings } from "@/lib/types";

/**
 * Passes when the caller holds at least one of `required`. Callers without a
 * session get 401; callers with a session but the wrong role get 403.
 *
 *   router.get('/users', authorize('users:read'), handler)
 *   router.post('/users', authorize('users:create', 'users:update'), handler)
 *   router.get('/admin', authorize(ROLES.admin.permissions), handler)
 */
export function authorize(...required: Permission[]) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const auth = c.get("auth");

    if (!auth) {
      throw new HTTPException(401, { message: "Authentication required" });
    }

    if (required.length > 0 && !required.some((permission) => auth.permissions.includes(permission))) {
      throw new HTTPException(403, {
        message: `Missing permission: ${required.join(" or ")}`,
      });
    }

    await next();
  });
}

/** Session required, no permission required. */
export function requireSession() {
  return authorize();
}
