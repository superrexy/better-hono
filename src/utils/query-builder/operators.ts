import type { Column } from "drizzle-orm";

/**
 * Filter operators a client may use as `filter[column][operator]`. `null` takes
 * a boolean: `filter[deletedAt][null]=true` means IS NULL, `=false` IS NOT NULL.
 */
export type FilterOperator =
  | "eq"
  | "ne"
  | "in"
  | "notIn"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "null";

/** What a column holds, resolved from its Drizzle `dataType`. */
export type FilterKind = "string" | "number" | "bigint" | "date" | "boolean" | "other";

const OPERATORS: readonly FilterOperator[] = [
  "eq",
  "ne",
  "in",
  "notIn",
  "contains",
  "startsWith",
  "endsWith",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "null",
];

/**
 * Drizzle's `dataType` is a template literal (`number int32`, `object date`,
 * `string timestamp`), so the kind is matched by prefix/suffix rather than
 * equality.
 */
export function kindOf(column: Column): FilterKind {
  const dataType = column.dataType;
  if (dataType.startsWith("bigint")) return "bigint";
  if (dataType.startsWith("number")) return "number";
  if (dataType === "boolean") return "boolean";
  if (dataType.includes("date") || dataType.includes("timestamp") || dataType.endsWith("time")) {
    return "date";
  }
  if (dataType.startsWith("string")) return "string";
  return "other";
}

const RANGE_KINDS = new Set<FilterKind>(["number", "bigint", "date"]);

/**
 * Operators a column accepts. Text gets the pattern operators, numbers and
 * dates the range operators, booleans only equality, and nullable columns
 * `null` on top.
 */
export function operatorsFor(column: Column): FilterOperator[] {
  const kind = kindOf(column);
  const base: FilterOperator[] = ["eq", "ne", "in", "notIn"];

  let extra: FilterOperator[] = [];
  if (kind === "string") extra = ["contains", "startsWith", "endsWith"];
  else if (RANGE_KINDS.has(kind)) extra = ["gt", "gte", "lt", "lte", "between"];

  return column.notNull ? [...base, ...extra] : [...base, ...extra, "null"];
}

/**
 * The operator a bare `filter[column]=value` turns into. Text defaults to a
 * partial, case-insensitive match; everything else to equality.
 */
export function defaultOperator(column: Column): FilterOperator {
  return kindOf(column) === "string" ? "contains" : "eq";
}

export function isFilterOperator(value: string): value is FilterOperator {
  return OPERATORS.some((operator) => operator === value);
}
