/**
 * Creates the bootstrap admin so a fresh database has one account that can sign
 * in. Sign-up goes through better-auth, so the `account` row holds a real
 * password hash instead of a hand-written one.
 *
 * Idempotent: an email that already exists is left alone, apart from its role.
 */
import { eq } from "drizzle-orm";
import type { RawDatabase } from "@/db";
import { user } from "@/db/schema";
import type { Auth } from "@/lib/auth";
import type { Environment } from "@/env";
import { ADMIN_ROLE } from "@/lib/permissions";

export type SeedAdminResult =
  | { status: "created"; email: string }
  | { status: "exists"; email: string }
  | { status: "skipped"; reason: string };

export async function seedAdminUser(
  env: Environment,
  db: RawDatabase,
  auth: Auth,
): Promise<SeedAdminResult> {
  const email = env.SEED_ADMIN_EMAIL.toLowerCase();

  if (!env.SEED_ADMIN_PASSWORD) {
    return { status: "skipped", reason: "SEED_ADMIN_PASSWORD is not set" };
  }

  const existing = await db
    .select({ id: user.id, roleId: user.roleId })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing.length > 0) {
    /**
     * The password is never reset here: the seed runs on every deploy, and
     * rewriting the hash would quietly undo a rotated credential.
     */
    if (existing[0].roleId !== ADMIN_ROLE) {
      await db
        .update(user)
        .set({ roleId: ADMIN_ROLE, updatedAt: new Date() })
        .where(eq(user.id, existing[0].id));
    }
    return { status: "exists", email };
  }

  const created = await auth.api.signUpEmail({
    body: { email, password: env.SEED_ADMIN_PASSWORD, name: env.SEED_ADMIN_NAME },
  });

  await db
    .update(user)
    .set({ roleId: ADMIN_ROLE, emailVerified: true, updatedAt: new Date() })
    .where(eq(user.id, created.user.id));

  return { status: "created", email };
}
