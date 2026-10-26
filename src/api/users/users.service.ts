import { HTTPException } from "hono/http-exception";
import type { UsersRepository } from "@/api/users/users.repository";
import type { Database } from "@/db";
import type { Auth } from "@/lib/auth";
import type { CreateUserBody, UpdateUserBody } from "@/api/users/users.schema";
import type { QueryParams } from "@/utils/query-builder";
import { createUsersRepository } from "@/api/users/users.repository";

export interface UsersServiceDeps {
  db: Database;
  auth: Auth;
}

export function createUsersService({ db, auth }: UsersServiceDeps) {
  const repository: UsersRepository = createUsersRepository(db);

  return {
    /** `query` is the raw query string: filters, sort, fields, include, page. */
    async list(query: QueryParams) {
      return repository.list(query);
    },

    async get(id: string) {
      const user = await repository.findById(id);
      if (!user) throw new HTTPException(404, { message: `User ${id} not found` });
      return user;
    },

    /**
     * Creates the account through better-auth so the `account` row matches what
     * sign-in expects. Without a password the account gets a random one nobody
     * knows, which leaves an emailed OTP as the only way in. Role is set on the
     * user row afterwards.
     */
    async create(body: CreateUserBody) {
      const existing = await repository.findByEmail(body.email);
      if (existing) {
        throw new HTTPException(409, { message: `Email ${body.email} is already registered` });
      }

      const created = await auth.api.signUpEmail({
        body: {
          email: body.email,
          name: body.name,
          password: body.password ?? unguessablePassword(),
        },
      });

      const user = await repository.updateRole(created.user.id, body.roleId);
      if (!user) {
        throw new HTTPException(500, { message: "User was created but could not be read back" });
      }
      return user;
    },

    async update(id: string, body: UpdateUserBody) {
      await this.get(id);

      const user = await repository.updateProfile(id, {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.roleId !== undefined ? { roleId: body.roleId } : {}),
      });

      if (!user) throw new HTTPException(404, { message: `User ${id} not found` });
      return user;
    },

    async remove(id: string, actorId: string) {
      if (id === actorId) {
        throw new HTTPException(400, { message: "You cannot delete your own account" });
      }

      const existing = await this.get(id);
      await repository.delete(id);
      return existing;
    },
  };
}

function unguessablePassword(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

export type UsersService = ReturnType<typeof createUsersService>;
