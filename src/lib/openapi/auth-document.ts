import type { Auth } from "@/lib/auth";

/**
 * better-auth generates its own OpenAPI document from the live auth instance
 * (`/api/auth/open-api/generate-schema`). Here it is merged into the app
 * document instead, so one Scalar page covers both surfaces and the session
 * cookie set by a sign-in call is reused by the app's guarded routes.
 *
 * Only two things differ between the two documents: better-auth's paths are
 * relative to its own server (`/sign-in/email`, not `/api/auth/sign-in/email`),
 * and its component schemas (`User`, `Session`, `Account`, `Verification`)
 * collide with the ones this app declares. Both are fixed here.
 */

export type AuthDocument = Awaited<ReturnType<Auth["api"]["generateOpenAPISchema"]>>;

/** Where `src/api/auth/auth.index.ts` mounts better-auth. */
const AUTH_BASE_PATH = "/api/auth";

/** A value an OpenAPI document is built from, as this module walks it. */
export type OpenAPIValue =
  | { [key: string]: OpenAPIValue }
  | OpenAPIValue[]
  | string
  | number
  | boolean
  | null;

export interface OpenAPIDocument {
  paths?: Record<string, OpenAPIValue>;
  components?: {
    schemas?: Record<string, OpenAPIValue>;
    securitySchemes?: Record<string, OpenAPIValue>;
    [key: string]: unknown;
  };
  tags?: { name: string; description?: string }[];
  [key: string]: unknown;
}

/**
 * better-auth authenticates with a session cookie in practice; its generated
 * document only advertises `bearerAuth`, because the cookie is set by the
 * sign-in call rather than sent by the caller. Declared so Scalar can show it.
 */
const SESSION_COOKIE_SCHEME: OpenAPIValue = {
  sessionCookie: {
    type: "apiKey",
    in: "cookie",
    name: "better-auth.session_token",
    description:
      "Session cookie set by POST /api/auth/sign-in/*. On this origin the browser stores it and every later request carries it automatically.",
  },
};

const SCHEMA_REF_PREFIX = "#/components/schemas/";

/** Renames better-auth's `User` to `AuthUser` so it cannot shadow the app's. */
function namespace(name: string): string {
  return `Auth${name}`;
}

function renameSchemaRefs(value: OpenAPIValue, names: ReadonlySet<string>): OpenAPIValue {
  if (Array.isArray(value)) return value.map((item) => renameSchemaRefs(item, names));

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).map(([key, entry]): [string, OpenAPIValue] => {
      if (key === "$ref" && typeof entry === "string" && entry.startsWith(SCHEMA_REF_PREFIX)) {
        const target = entry.slice(SCHEMA_REF_PREFIX.length);
        return [key, names.has(target) ? `${SCHEMA_REF_PREFIX}${namespace(target)}` : entry];
      }

      return [key, renameSchemaRefs(entry, names)];
    });

    return Object.fromEntries(entries);
  }

  return value;
}

export function mergeAuthDocument(
  document: OpenAPIDocument,
  authDocument: AuthDocument,
): OpenAPIDocument {
  // SAFETY: better-auth's generated document is plain JSON; its declared types
  // are narrower than the walker needs, the shape is asserted once here.
  const generated = authDocument as unknown as OpenAPIDocument;

  const authSchemas = generated.components?.schemas ?? {};
  const schemaNames = new Set(Object.keys(authSchemas));

  const authPaths = Object.fromEntries(
    Object.entries(generated.paths ?? {}).map(([path, operations]) => [
      `${AUTH_BASE_PATH}${path}`,
      renameSchemaRefs(operations, schemaNames),
    ]),
  );

  const authComponents = Object.fromEntries(
    Object.entries(authSchemas).map(([name, schema]) => [
      namespace(name),
      renameSchemaRefs(schema, schemaNames),
    ]),
  );

  // App paths and schemas win a collision: they are the contract this repo owns.
  const tags = [...(document.tags ?? [])];
  for (const tag of generated.tags ?? []) {
    if (!tags.some((existing) => existing.name === tag.name)) tags.push(tag);
  }

  return {
    ...document,
    paths: { ...authPaths, ...document.paths },
    tags,
    components: {
      ...document.components,
      schemas: { ...authComponents, ...document.components?.schemas },
      securitySchemes: {
        ...(SESSION_COOKIE_SCHEME as Record<string, OpenAPIValue>),
        ...generated.components?.securitySchemes,
        ...document.components?.securitySchemes,
      },
    },
  };
}
