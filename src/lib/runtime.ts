import { createDb, createDrizzle } from "@/db";
import { createAuth } from "@/lib/auth";
import type { Database, RawDatabase } from "@/db";
import type { Auth } from "@/lib/auth";
import type { Environment } from "@/env";

/**
 * Everything a request needs that is scoped to the environment: the query
 * client (better-drizzle delegates) and the auth instance. Both share one raw
 * Drizzle client, so a request opens a single connection pool, not two.
 */
export interface Runtime {
  db: Database;
  raw: RawDatabase;
  auth: Auth;
}

export function createRuntime(env: Environment): Runtime {
  const raw = createDrizzle(env);
  return {
    raw,
    db: createDb(env, raw),
    auth: createAuth(env, raw),
  };
}
