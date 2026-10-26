import { defineOpenAPIRoute } from "@hono/zod-openapi";
import { principal } from "@/lib/principal";
import { meSchema } from "@/api/me/me.schema";
import { meRoute } from "@/api/me/me.route";

export const me = defineOpenAPIRoute({
  route: meRoute,
  handler: async (c) => {
    const { user, role, permissions, session } = principal(c);

    return c.json(
      meSchema.parse({
        user,
        role,
        permissions,
        session: { id: session.id, expiresAt: session.expiresAt },
      }),
      200,
    );
  },
});
