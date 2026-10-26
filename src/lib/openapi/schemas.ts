import { z } from "@hono/zod-openapi";

/**
 * Response envelopes shared by every documented route. Declaring them once
 * registers a single component (`Error`, `ValidationError`, `Pagination`) that
 * each `createRoute()` responses block references.
 */

export const errorSchema = z
  .object({
    message: z.string().openapi({ example: "User 6f1d… not found" }),
    /** Rendered only outside production, see `src/middlewares/on-error.ts`. */
    stack: z.string().optional(),
  })
  .openapi("Error");

export const validationIssueSchema = z.object({
  path: z.string().openapi({ example: "email" }),
  message: z.string().openapi({ example: "Invalid email address" }),
});

export const validationErrorSchema = z
  .object({
    message: z.string().openapi({ example: "Validation failed" }),
    issues: z.array(validationIssueSchema),
  })
  .openapi("ValidationError");

export const paginationSchema = z
  .object({
    page: z.number().int().openapi({ example: 1 }),
    perPage: z.number().int().openapi({ example: 20 }),
    total: z.number().int(),
    pageCount: z.number().int(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  })
  .openapi("Pagination");
