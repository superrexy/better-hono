/**
 * Global setup, loaded before any test file through `bunfig.toml` `preload`.
 *
 * Runs once per `bun test` process: create the database if it is missing, bring
 * it to the current schema, then seed the role/permission reference data.
 * `withSetupLock` serialises that work when `--parallel` gives each worker its
 * own process.
 */
import { afterAll } from "bun:test";
import "./helpers/env";
import {
  ensureTestDatabase,
  migrateTestDatabase,
  seedReferenceData,
  withSetupLock,
} from "./helpers/db";
import { raw } from "./helpers/runtime";

await withSetupLock(async () => {
  await ensureTestDatabase();
  await migrateTestDatabase();
  await seedReferenceData();
});

afterAll(async () => {
  // Close the shared pool so `bun test` exits instead of waiting on handles.
  await raw.$client.end();
});
