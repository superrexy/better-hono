import { createRoute } from "@hono/zod-openapi";
import { authorize } from "@/middlewares/authorize";
import { errorSchema, validationErrorSchema } from "@/lib/openapi/schemas";
import {
  createUserBody,
  updateUserBody,
  userIdParam,
  userListSchema,
  userSchema,
} from "@/api/users/users.schema";

/**
 * Route objects for the users module: method, path, guards, request schemas and
 * responses. `src/api/users/users.handler.ts` binds a handler to each of these,
 * and `users.index.ts` mounts them. Nothing here touches the database.
 *
 * The guards live in `middleware` so the order stays authorize → validate →
 * handler, exactly as a hand-chained `router.get(path, authorize(), validate())`
 * would run.
 */

const tags = ["Users"];

const LIST_DESCRIPTION = `Filters, sorts, field selection and pagination are parsed from the raw
query string by \`src/utils/query-builder\`, against a per-resource allowlist.

\`\`\`
?filter[roleId][eq]=admin&filter[or][email]=a@b.c&filter[or][name]=ann
 &sort=-createdAt,email&fields=id,email&include=role&page=2&perPage=20
\`\`\`

- \`filter[column]=value\`, \`filter[column]=a,b\` (IN), \`filter[column][operator]=value\`
- \`sort=-createdAt,email\` (\`-\` is descending), \`fields=id,email\`, \`include=role\`
- \`page\`/\`perPage\` (default 20, max 100)

Anything outside the allowlist answers 400.`;

const notFound = {
  description: "No user with that id",
  content: { "application/json": { schema: errorSchema } },
};

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

export const listUsersRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List users",
  description: LIST_DESCRIPTION,
  middleware: [authorize("users:read")] as const,
  responses: {
    200: {
      description: "A page of users",
      content: { "application/json": { schema: userListSchema } },
    },
    400: invalid,
    401: unauthorized,
    403: forbidden,
  },
});

export const getUserRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags,
  summary: "Get one user",
  middleware: [authorize("users:read")] as const,
  request: { params: userIdParam },
  responses: {
    200: {
      description: "The user",
      content: { "application/json": { schema: userSchema } },
    },
    400: invalid,
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
});

export const createUserRoute = createRoute({
  method: "post",
  path: "/",
  tags,
  summary: "Create a user",
  description:
    "Created through better-auth, so the `account` row matches what sign-in expects. Without a `password` the account can only be entered with an emailed OTP.",
  middleware: [authorize("users:create")] as const,
  request: {
    body: { content: { "application/json": { schema: createUserBody } }, required: true },
  },
  responses: {
    201: {
      description: "The created user",
      content: { "application/json": { schema: userSchema } },
    },
    400: invalid,
    401: unauthorized,
    403: forbidden,
    409: {
      description: "Email already registered",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const updateUserRoute = createRoute({
  method: "patch",
  path: "/{id}",
  tags,
  summary: "Update a user",
  middleware: [authorize("users:update")] as const,
  request: {
    params: userIdParam,
    body: { content: { "application/json": { schema: updateUserBody } }, required: true },
  },
  responses: {
    200: {
      description: "The updated user",
      content: { "application/json": { schema: userSchema } },
    },
    400: invalid,
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
});

export const deleteUserRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags,
  summary: "Delete a user",
  description: "Deleting your own account answers 400.",
  middleware: [authorize("users:delete")] as const,
  request: { params: userIdParam },
  responses: {
    200: {
      description: "The user as it was before deletion",
      content: { "application/json": { schema: userSchema } },
    },
    400: invalid,
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
});
