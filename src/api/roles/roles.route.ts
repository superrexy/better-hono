import { createRoute } from "@hono/zod-openapi";
import { authorize } from "@/middlewares/authorize";
import { errorSchema, validationErrorSchema } from "@/lib/openapi/schemas";
import { roleIdParam, roleSchema } from "@/api/roles/roles.schema";

const tags = ["Roles"];

const unauthorized = {
  description: "No session",
  content: { "application/json": { schema: errorSchema } },
};

const forbidden = {
  description: "Session without the required permission",
  content: { "application/json": { schema: errorSchema } },
};

const invalid = {
  description: "Validation failed",
  content: { "application/json": { schema: validationErrorSchema } },
};

export const listRolesRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List roles",
  description: "Roles and their permissions straight from the database, not from the code enum.",
  middleware: [authorize("roles:read")] as const,
  responses: {
    200: {
      description: "Every role",
      content: { "application/json": { schema: roleSchema.array() } },
    },
    401: unauthorized,
    403: forbidden,
  },
});

export const getRoleRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags,
  summary: "Get one role",
  middleware: [authorize("roles:read")] as const,
  request: { params: roleIdParam },
  responses: {
    200: {
      description: "The role",
      content: { "application/json": { schema: roleSchema } },
    },
    400: invalid,
    401: unauthorized,
    403: forbidden,
    404: {
      description: "Role is declared in code but missing from the database: run `bun run db:seed`",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
