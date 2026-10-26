import { createRoute } from "@hono/zod-openapi";
import { requireSession } from "@/middlewares/authorize";
import { errorSchema } from "@/lib/openapi/schemas";
import { meSchema } from "@/api/me/me.schema";

export const meRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Session"],
  summary: "The caller's principal",
  description:
    "Resolved once per request by `withAuth`: the better-auth user and session, the role slug, and the permissions that role grants.",
  // `requireSession()` is `authorize()` with no permission: session required.
  middleware: [requireSession()] as const,
  responses: {
    200: {
      description: "The principal behind the session cookie",
      content: { "application/json": { schema: meSchema } },
    },
    401: {
      description: "No session",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
