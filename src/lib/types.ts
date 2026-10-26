import type { Environment } from "@/env";
import type { AuthSession, AuthUser, Auth } from "@/lib/auth";
import type { Database } from "@/db";
import type { Permission } from "@/lib/permissions";

/**
 * Principal resolved once per request by `withAuth`: the authenticated user,
 * their role slug, and the permission strings that role grants.
 */
export interface AuthPrincipal {
  user: AuthUser;
  session: AuthSession;
  role: string;
  permissions: Permission[];
}

export interface AppBindings {
  Bindings: Environment;
  Variables: {
    db: Database;
    /** The better-auth instance for this request. */
    authApi: Auth;
    user: AuthUser | null;
    session: AuthSession | null;
    /** Set only when a session exists. */
    auth: AuthPrincipal | null;
  };
}
