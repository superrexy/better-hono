import { z } from "@hono/zod-openapi";
import { PERMISSIONS, ROLE_NAMES } from "@/lib/permissions";

export const authUserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullish(),
    roleId: z.string().nullish(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi("AuthUser");

/** The principal `withAuth` resolves for the caller, as `GET /api/me` returns it. */
export const meSchema = z
  .object({
    user: authUserSchema,
    role: z.enum(ROLE_NAMES).openapi({ example: "user" }),
    permissions: z.array(z.enum(PERMISSIONS)),
    session: z.object({
      id: z.string(),
      expiresAt: z.date(),
    }),
  })
  .openapi("Me");
