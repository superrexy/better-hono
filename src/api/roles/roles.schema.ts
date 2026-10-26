import { z } from "@hono/zod-openapi";
import { ROLE_NAMES } from "@/lib/permissions";

/** Roles only exist in code, so an unknown slug is a bad request, not a 404. */
export const roleIdParam = z.object({
  id: z.enum(ROLE_NAMES).openapi({
    param: { name: "id", in: "path" },
    example: ROLE_NAMES[0],
  }),
});

export const roleSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    permissions: z.array(z.object({ id: z.string() })),
  })
  .openapi("Role");

export type RoleIdParam = z.infer<typeof roleIdParam>;
