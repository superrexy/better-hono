/**
 * Mirrors the code declarations in `src/lib/permissions.ts` into the database,
 * then creates the bootstrap admin.
 *
 *   bun run db:seed
 */
import env from "@/env-runtime";
import { createRuntime } from "@/lib/runtime";
import { seedRbac } from "@/db/seed-rbac";
import { seedAdminUser } from "@/db/seed-user";
import { PERMISSIONS, ROLES } from "@/lib/permissions";

const runtime = createRuntime(env);

await seedRbac(runtime.raw);

console.info(
  `seeded ${PERMISSIONS.length} permission(s) and ${Object.keys(ROLES).length} role(s)`,
);

const admin = await seedAdminUser(env, runtime.raw, runtime.auth);

if (admin.status === "skipped") {
  console.info(`skipped admin seed: ${admin.reason}`);
} else {
  console.info(`admin ${admin.status}: ${admin.email}`);
}

process.exit(0);
