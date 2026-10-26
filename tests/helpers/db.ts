import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, escapeIdentifier } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { raw } from "./runtime";
import { TEST_DATABASE_URL } from "./env";
import { seedRbac } from "@/db/seed-rbac";

/** Only plain lowercase identifiers, so nothing surprising reaches CREATE DATABASE. */
const SAFE_NAME = /^[a-z0-9_]+$/;

/**
 * The suite writes and deletes rows, so it must never touch a real database.
 * Requiring a `_test` suffix is the cheapest guard that actually holds.
 */
export function assertTestDatabase(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));

  if (!name.endsWith("_test") || !SAFE_NAME.test(name)) {
    throw new Error(
      `Refusing to run e2e tests against database "${name}": the name must end with "_test".`,
    );
  }

  return name;
}

async function withClient<T>(url: string, run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** Creates the test database when it is missing. Tolerates a racing creator. */
export async function ensureTestDatabase(): Promise<void> {
  const name = assertTestDatabase(TEST_DATABASE_URL);
  const maintenanceUrl = new URL(TEST_DATABASE_URL);
  maintenanceUrl.pathname = "/postgres";

  await withClient(maintenanceUrl.toString(), async (client) => {
    const existing = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (existing.rowCount && existing.rowCount > 0) return;

    try {
      // CREATE DATABASE takes an identifier, not a bind parameter, so it cannot be
      // parameterized. escapeIdentifier quotes it and doubles any embedded quote,
      // and assertTestDatabase has already restricted the name to [a-z0-9_].
      const statement = "create database " + escapeIdentifier(name);
      await client.query(statement);
    } catch (error) {
      // Another worker may have created it between the check and the create.
      if ((error as { code?: string }).code !== "42P04") throw error;
    }
  });
}

/** Arbitrary constant; any value works as long as every worker agrees on it. */
const SETUP_LOCK_KEY = 728_411_902;

/**
 * Serialises setup across `--parallel` workers, which each run the preload in
 * their own process. Without this, two workers can run DDL migrations at the
 * same time and one of them fails.
 */
export async function withSetupLock<T>(run: () => Promise<T>): Promise<T> {
  const url = new URL(TEST_DATABASE_URL);
  // Lock on the maintenance database, which always exists.
  url.pathname = "/postgres";

  return withClient(url.toString(), async (client) => {
    await client.query("select pg_advisory_lock($1)", [SETUP_LOCK_KEY]);
    try {
      return await run();
    } finally {
      await client.query("select pg_advisory_unlock($1)", [SETUP_LOCK_KEY]);
    }
  });
}

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../src/db/migrations", import.meta.url));

export async function migrateTestDatabase(): Promise<void> {
  assertTestDatabase(TEST_DATABASE_URL);
  await migrate(raw, { migrationsFolder: path.resolve(MIGRATIONS_FOLDER) });
}

/** Roles and permissions are reference data: seeded once, never truncated. */
export async function seedReferenceData(): Promise<void> {
  await seedRbac(raw);
}
