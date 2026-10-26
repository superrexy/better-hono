import type { Context, Schema } from "hono";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import type { AppBindings } from "@/lib/types";
import { mergeAuthDocument } from "@/lib/openapi/auth-document";
import type { OpenAPIDocument } from "@/lib/openapi/auth-document";
import { API_TAGS } from "@/lib/openapi/tags";

/** The JSON document Scalar reads, and the page it renders it on. */
export const DOC_PATH = "/doc";
export const SCALAR_PATH = "/reference";

const DESCRIPTION = `Every route is declared with \`createRoute()\` and validated by zod, so this
document is generated from the same schemas the handlers use.

### Trying the auth flows

better-auth's endpoints are merged below under \`/api/auth\`. Sign in first, then call
\`/api/me\`:

1. \`POST /api/auth/sign-up/email\`, or the password-less pair
   \`POST /api/auth/email-otp/send-verification-otp\` then \`POST /api/auth/sign-in/email-otp\`.
2. The response sets a session cookie. This page is served from the API origin, so the
   browser stores it and every later request carries it.
3. \`GET /api/me\` reports the principal; \`GET /api/users\` needs \`users:read\`.

In development the OTP is printed by the server (\`[mail] to=… body=Your code is …\`),
not emailed.`;

/**
 * Adds better-auth's document to the generated one, on demand rather than at
 * boot, because the auth half comes from the per-request auth instance.
 *
 * The server URL is the configured auth origin rather than one parsed from the
 * request, so the document cannot be pointed anywhere by a spoofed Host header.
 */
export async function withAuthDocument<E extends AppBindings>(
  document: OpenAPIDocument,
  c: Context<E>,
): Promise<OpenAPIDocument> {
  return mergeAuthDocument(document, await c.get("authApi").api.generateOpenAPISchema());
}

/**
 * Serves the document at `/doc` and the Scalar UI at `/reference`.
 *
 * Both are plain routes on the root app, so they never appear in the document
 * itself and are not part of `AppType`. Generic over the app's route schema for
 * the same reason: the caller's chained routes must survive this call.
 */
export function registerDocs<E extends AppBindings, S extends Schema, B extends string>(
  app: OpenAPIHono<E, S, B>,
): OpenAPIHono<E, S, B> {
  app.get(DOC_PATH, async (c) => {
    const document = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: {
        title: "Better Hono API",
        version: "1.0.0",
        description: DESCRIPTION,
      },
      servers: [{ url: c.env.BETTER_AUTH_URL }],
      tags: API_TAGS,
      // Applies to every operation that does not declare its own security, which
      // is every app route: they all read the session set by /api/auth/sign-*.
      security: [{ sessionCookie: [] }],
    });

    // SAFETY: the generated document is plain JSON, including the paths it
    // types as `PathItemObject`; the merge only walks it as JSON.
    return c.json(await withAuthDocument(document as unknown as OpenAPIDocument, c));
  });

  app.get(
    SCALAR_PATH,
    Scalar({
      url: DOC_PATH,
      pageTitle: "Better Hono API",
      theme: "default",
    }),
  );

  return app;
}
