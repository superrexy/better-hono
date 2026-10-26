import { QueryBuilderError } from "./errors";
import type { QueryParams } from "./errors";

/**
 * Nested view of the flat query string: `filter[role][contains]=adm` becomes
 * `{ filter: { role: { contains: "adm" } } }`. Values are always strings, and
 * a bracket-less key stays a plain key (`sort=-createdAt`).
 */
export type ParsedParams = Record<string, unknown>;

const KEY = /^([^[\]]+)((?:\[[^[\]]*\])*)$/;
const SEGMENT = /\[([^[\]]*)\]/g;
const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);

function setDeep(target: Record<string, unknown>, segments: string[], value: string): void {
  let node = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index] ?? "";
    if (UNSAFE.has(key)) return;
    const current = node[key];
    if (typeof current !== "object" || current === null) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  const last = segments.at(-1) ?? "";
  if (!UNSAFE.has(last)) node[last] = value;
}

/**
 * Turns `?filter[a][b]=1` into nested objects. A repeated plain key
 * (`?fields=a&fields=b`) keeps its last value, like Hono's `c.req.query()`.
 */
export function parseQueryParams(params: QueryParams): ParsedParams {
  const parsed: ParsedParams = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const joined = Array.isArray(value) ? (value.at(-1) ?? "") : value;

    const match = KEY.exec(key);
    if (!match) continue;
    const root = match[1] ?? "";
    const brackets = match[2] ?? "";
    const segments = [root, ...[...brackets.matchAll(SEGMENT)].map((found) => found[1] ?? "")];
    setDeep(parsed, segments, joined);
  }

  return parsed;
}

/** `a, b ,c` and `a` both become a clean list. */
export function parseList(raw: string): string[] {
  return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
}

/** `true`, `1` and the empty value all mean "on" — no casts at the call site. */
export function toBoolean(raw: string): boolean {
  return raw === "" || raw === "true" || raw === "1";
}

/** A scalar object value (`sort=-a`, `page=1`) or `undefined` when absent. */
export function scalarParam(parsed: ParsedParams, key: string): string | undefined {
  const raw = parsed[key];
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") {
    throw new QueryBuilderError(`Parameter '${key}' tidak boleh bertingkat`, { key });
  }
  return raw === "" ? undefined : raw;
}
