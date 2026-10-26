import { HTTPException } from "hono/http-exception";
import type { Database } from "@/db";
import type { RoleName } from "@/lib/permissions";
import { createRolesRepository } from "@/api/roles/roles.repository";

export function createRolesService(db: Database) {
  const repository = createRolesRepository(db);

  return {
    list() {
      return repository.list();
    },

    async get(id: RoleName) {
      const role = await repository.findById(id);
      if (!role) {
        throw new HTTPException(404, {
          message: `Role ${id} is declared in code but missing from the database. Run: bun run db:seed`,
        });
      }
      return role;
    },
  };
}

export type RolesService = ReturnType<typeof createRolesService>;
