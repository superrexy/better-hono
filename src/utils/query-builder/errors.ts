/**
 * Raw query params as they arrive from the HTTP layer: Hono's `c.req.query()`
 * gives flat strings, `c.req.queries()` gives `string[]`.
 */
export type QueryParams = Record<string, string | string[] | undefined>;

/**
 * A client-supplied query string that the allowlist rejects or that cannot be
 * turned into a valid query. It carries `status = 400` so `onError` already
 * answers with a 400 instead of a 500 — no middleware change needed.
 */
export class QueryBuilderError extends Error {
  readonly status = 400;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "QueryBuilderError";
  }
}

export function notAllowed(kind: string, name: string, allowed: Iterable<string>): QueryBuilderError {
  return new QueryBuilderError(`${kind} '${name}' tidak diizinkan`, {
    allowed: [...allowed].sort(),
  });
}
