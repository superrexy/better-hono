/**
 * Mirrors the code declarations in `src/lib/permissions.ts` into the database.
 *
 * Idempotent, and safe to call from tests. Permissions and roles are never
 * created through the API, so this is the only write path for them.
 */
import { eq, notInArray } from "drizzle-orm";
import type { RawDatabase } from "@/db";
import { permission, role, rolePermission } from "@/db/schema";
import { PERMISSIONS, ROLES } from "@/lib/permissions";
import type { RoleName } from "@/lib/permissions";

export async function seedRbac(db: RawDatabase): Promise<void> {
  const now = new Date();

  await db.transaction(async (tx) => {
    for (const id of PERMISSIONS) {
      await tx
        .insert(permission)
        .values({ id, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: permission.id, set: { updatedAt: now } });
    }

    for (const key of Object.keys(ROLES) as RoleName[]) {
      const definition = ROLES[key];

      await tx
        .insert(role)
        .values({
          id: key,
          name: definition.name,
          description: definition.description,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: role.id,
          set: { name: definition.name, description: definition.description, updatedAt: now },
        });

      // Replace the mapping wholesale so permissions removed from code disappear.
      await tx.delete(rolePermission).where(eq(rolePermission.roleId, key));

      if (definition.permissions.length > 0) {
        await tx
          .insert(rolePermission)
          .values(definition.permissions.map((permissionId) => ({ roleId: key, permissionId })))
          .onConflictDoNothing();
      }
    }

    // Drop permissions that no longer exist in code.
    await tx.delete(permission).where(notInArray(permission.id, [...PERMISSIONS]));
  });
}
