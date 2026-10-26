import { createMiddleware } from "hono/factory";
import { isPermission } from "@/lib/permissions";
import type { Permission } from "@/lib/permissions";
import type { AppBindings, AuthPrincipal } from "@/lib/types";

/**
 * Resolves the session, then loads the role and its permissions once per
 * request. Everything downstream reads from the context, never the database.
 */
const withAuth = createMiddleware<AppBindings>(async (c, next) => {
  c.set("user", null);
  c.set("session", null);
  c.set("auth", null);

  const session = await c.get("authApi").api.getSession({ headers: c.req.raw.headers });
  if (!session) return next();

  c.set("user", session.user);
  c.set("session", session.session);

  const record = await c.get("db").user.findUnique({
    where: { id: session.user.id },
    include: { role: { include: { permissions: true } } },
  });

  if (record?.role) {
    const permissions = record.role.permissions
      .map((row) => row.id)
      .filter(isPermission) satisfies Permission[];

    const principal: AuthPrincipal = {
      user: session.user,
      session: session.session,
      role: record.role.id,
      permissions,
    };
    c.set("auth", principal);
  }

  return next();
});

export default withAuth;
