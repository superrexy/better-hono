import type { Database } from "@/db";
import type { RoleName } from "@/lib/permissions";

export function createRolesRepository(db: Database) {
  return {
    list() {
      return db.role.findMany({
        include: { permissions: { select: { id: true }, orderBy: { id: "asc" } } },
        orderBy: { id: "asc" },
      });
    },

    findById(id: RoleName) {
      return db.role.findUnique({
        where: { id },
        include: { permissions: { select: { id: true }, orderBy: { id: "asc" } } },
      });
    },
  };
}

export type RolesRepository = ReturnType<typeof createRolesRepository>;
