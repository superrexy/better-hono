import type { Database } from "@/db";
import type { RoleName } from "@/lib/permissions";
import { qb } from "@/utils/query-builder";
import type { QueryParams } from "@/utils/query-builder";

/**
 * Public shape of a user. Never selects the password (that lives in `account`).
 */
const userSelect = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
};

export function createUsersRepository(db: Database) {
  return {
    /**
     * Paginated, filterable, sortable list. `query` is the raw query string:
     * `?filter[roleId][eq]=admin&sort=-createdAt&include=role&page=2`.
     */
    list(query: QueryParams) {
      return qb(db, "user", query, { defaultInclude: ["role"] })
        .allowedFilters("email", "name", "emailVerified", "roleId", "createdAt")
        .allowedSorts("email", "name", "createdAt", "updatedAt")
        .allowedFields(
          "id",
          "email",
          "name",
          "emailVerified",
          "image",
          "roleId",
          "createdAt",
          "updatedAt",
        )
        .allowedIncludes({ role: { select: { id: true, name: true } } })
        .defaultSort("-createdAt")
        .execute();
    },

    findById(id: string) {
      return db.user.findUnique({ where: { id }, select: userSelect });
    },

    findByEmail(email: string) {
      return db.user.findUnique({ where: { email }, select: userSelect });
    },

    updateRole(id: string, roleId: RoleName) {
      return db.user.update({ where: { id }, data: { roleId }, select: userSelect });
    },

    updateProfile(id: string, data: { name?: string; roleId?: RoleName }) {
      return db.user.update({ where: { id }, data, select: userSelect });
    },

    /** Relations cannot be loaded from a DELETE, so callers return the row they already read. */
    delete(id: string) {
      return db.user.delete({ where: { id }, select: { id: true } });
    },
  };
}

export type UsersRepository = ReturnType<typeof createUsersRepository>;
