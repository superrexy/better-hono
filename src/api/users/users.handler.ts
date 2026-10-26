import { defineOpenAPIRoute } from "@hono/zod-openapi";
import { principal } from "@/lib/principal";
import type { AppContext } from "@/lib/principal";
import {
  createUserRoute,
  deleteUserRoute,
  getUserRoute,
  listUsersRoute,
  updateUserRoute,
} from "@/api/users/users.route";
import { userListSchema, userSchema } from "@/api/users/users.schema";
import { createUsersService } from "@/api/users/users.service";

/** Services are per request because db and auth come from the request context. */
const service = (c: AppContext) =>
  createUsersService({ db: c.get("db"), auth: c.get("authApi") });

export const listUsers = defineOpenAPIRoute({
  route: listUsersRoute,
  handler: async (c) => {
    // The query string is validated by the query builder (filters, sort, fields,
    // include, page), so the raw params are passed through instead of a zod
    // schema: `?fields=` narrowing is not expressible as a static object.
    return c.json(userListSchema.parse(await service(c).list(c.req.query())), 200);
  },
});

export const getUser = defineOpenAPIRoute({
  route: getUserRoute,
  handler: async (c) =>
    c.json(userSchema.parse(await service(c).get(c.req.valid("param").id)), 200),
});

export const createUser = defineOpenAPIRoute({
  route: createUserRoute,
  handler: async (c) =>
    c.json(userSchema.parse(await service(c).create(c.req.valid("json"))), 201),
});

export const updateUser = defineOpenAPIRoute({
  route: updateUserRoute,
  handler: async (c) =>
    c.json(
      userSchema.parse(await service(c).update(c.req.valid("param").id, c.req.valid("json"))),
      200,
    ),
});

export const deleteUser = defineOpenAPIRoute({
  route: deleteUserRoute,
  handler: async (c) =>
    c.json(
      userSchema.parse(await service(c).remove(c.req.valid("param").id, principal(c).user.id)),
      200,
    ),
});
