import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppBindings, AuthPrincipal } from "@/lib/types";

export type AppContext = Context<AppBindings>;

/** `authorize()` already guarded the route, so a missing principal is a bug. */
export function principal(c: AppContext): AuthPrincipal {
  const auth = c.get("auth");
  if (!auth) throw new HTTPException(401, { message: "Authentication required" });
  return auth;
}
