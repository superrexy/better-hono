import { defineOpenAPIRoute } from "@hono/zod-openapi";
import { roleSchema } from "@/api/roles/roles.schema";
import { getRoleRoute, listRolesRoute } from "@/api/roles/roles.route";
import { createRolesService } from "@/api/roles/roles.service";

export const listRoles = defineOpenAPIRoute({
  route: listRolesRoute,
  handler: async (c) =>
    c.json(roleSchema.array().parse(await createRolesService(c.get("db")).list()), 200),
});

export const getRole = defineOpenAPIRoute({
  route: getRoleRoute,
  handler: async (c) =>
    c.json(
      roleSchema.parse(await createRolesService(c.get("db")).get(c.req.valid("param").id)),
      200,
    ),
});
