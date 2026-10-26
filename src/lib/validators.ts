import { zValidator } from "@hono/zod-validator";
import type { z } from "zod";

/**
 * The 400 body every rejected payload produces. Shared by `validate()` and by
 * the OpenAPI route hook (`openAPIDefaultHook`), so a documented route and a
 * hand-validated one answer with the same envelope.
 */
export interface ValidationErrorBody {
  message: string;
  issues: { path: string; message: string }[];
}

export function validationErrorBody(
  issues: readonly { path?: PropertyKey[] | undefined; message: string }[],
): ValidationErrorBody {
  return {
    message: "Validation failed",
    issues: issues.map((issue) => ({
      path: (issue.path ?? []).join("."),
      message: issue.message,
    })),
  };
}

/**
 * Turns a validation failure into the same error envelope the rest of the API
 * uses, instead of leaking raw zod issues via the library default.
 *
 * Routes built with `createRoute()` do not need this: their `request` schemas
 * are validated by `openAPIDefaultHook`, which renders the same body. Keep this
 * for routes that stay on plain `router.get(...)`.
 */
export const validate = <T extends z.ZodType, Target extends "json" | "query" | "param">(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(validationErrorBody(result.error.issues), 400);
    }
  });
