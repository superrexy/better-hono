import { z } from "@hono/zod-openapi";
import { DEFAULT_ROLE, ROLE_NAMES } from "@/lib/permissions";
import { paginationSchema } from "@/lib/openapi/schemas";

/** Path params carry `param` metadata, otherwise they are documented as query. */
export const userIdParam = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: { name: "id", in: "path" },
      example: "9Wq3Wj1n0mYb0RJc8xQ2k",
    }),
});

export const createUserBody = z
  .object({
    email: z.email().openapi({ example: "ann@example.com" }),
    name: z.string().trim().min(1).max(120).openapi({ example: "Ann" }),
    /**
     * Optional. Without it the account is password-less and the person signs in
     * with an emailed OTP instead.
     */
    password: z.string().min(8).max(128).optional().openapi({ example: "correct-horse-battery" }),
    roleId: z.enum(ROLE_NAMES).default(DEFAULT_ROLE).openapi({ example: DEFAULT_ROLE }),
  })
  .openapi("CreateUserBody");

export const updateUserBody = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    roleId: z.enum(ROLE_NAMES).optional(),
  })
  .refine((body) => body.name !== undefined || body.roleId !== undefined, {
    message: "Provide at least one of name or roleId",
  })
  .openapi("UpdateUserBody");

/**
 * What `userSelect` in the repository returns. Timestamps are `z.date()`: the
 * value is a `Date` in the service and an ISO string on the wire, and
 * `z.date()` documents as `string`/`date-time` without lying about the type.
 */
export const userSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    emailVerified: z.boolean(),
    roleId: z.string().openapi({ example: DEFAULT_ROLE }),
    createdAt: z.date(),
    updatedAt: z.date(),
    role: z.object({ id: z.string(), name: z.string() }).nullable(),
  })
  .openapi("User");

/**
 * Rows are partial because `?fields=` narrows the projection, and an included
 * relation only appears when `?include=` asks for it.
 */
export const userListSchema = z
  .object({
    data: z.array(userSchema.partial()),
    pagination: paginationSchema.nullable(),
  })
  .openapi("UserList");

export type UserIdParam = z.infer<typeof userIdParam>;
export type CreateUserBody = z.infer<typeof createUserBody>;
export type UpdateUserBody = z.infer<typeof updateUserBody>;
