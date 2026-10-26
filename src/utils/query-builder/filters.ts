import type { Column } from "drizzle-orm";
import { QueryBuilderError, notAllowed } from "./errors";
import { defaultOperator, isFilterOperator, kindOf, operatorsFor } from "./operators";
import type { FilterOperator } from "./operators";
import { parseList, toBoolean } from "./params";

/** A value a column can be compared against after coercion. */
export type ScalarValue = string | number | bigint | boolean | Date;

/**
 * The value side of one better-drizzle filter, e.g. `{ gte: Date }` or
 * `{ contains: "adm", mode: "insensitive" }`. Kept as a named union so the
 * builder can report what it produced instead of `unknown`.
 */
export type FilterValue =
  | ScalarValue
  | null
  | { in: ScalarValue[] }
  | { notIn: ScalarValue[] }
  | { not: ScalarValue | null }
  | { contains: string; mode: "insensitive" }
  | { startsWith: string; mode: "insensitive" }
  | { endsWith: string; mode: "insensitive" }
  | { gt?: ScalarValue; gte?: ScalarValue; lt?: ScalarValue; lte?: ScalarValue };

/**
 * Coerces a query-string value to the JS type the column compares against.
 * Postgres casts most of these implicitly, but dates, numbers, bigints and
 * booleans are checked here so a typo comes back as a 400, not a driver error.
 */
export function coerce(column: Column, raw: string): ScalarValue {
  switch (kindOf(column)) {
    case "number": {
      const value = Number(raw);
      if (raw.trim() === "" || Number.isNaN(value)) {
        throw new QueryBuilderError(`Nilai '${raw}' bukan angka untuk filter '${column.name}'`);
      }
      return value;
    }
    case "bigint": {
      try {
        return BigInt(raw);
      } catch {
        throw new QueryBuilderError(`Nilai '${raw}' bukan bilangan bulat untuk filter '${column.name}'`);
      }
    }
    case "boolean": {
      if (raw === "true" || raw === "1") return true;
      if (raw === "false" || raw === "0") return false;
      throw new QueryBuilderError(`Nilai '${raw}' bukan boolean untuk filter '${column.name}'`);
    }
    case "date": {
      const value = new Date(raw);
      if (Number.isNaN(value.getTime())) {
        throw new QueryBuilderError(`Nilai '${raw}' bukan tanggal untuk filter '${column.name}'`);
      }
      return value;
    }
    default:
      return raw;
  }
}

/** Case-insensitive pattern match — the default for text columns. */
function pattern(operator: "contains" | "startsWith" | "endsWith", raw: string): FilterValue {
  switch (operator) {
    case "contains":
      return { contains: raw, mode: "insensitive" };
    case "startsWith":
      return { startsWith: raw, mode: "insensitive" };
    case "endsWith":
      return { endsWith: raw, mode: "insensitive" };
    default:
      throw new QueryBuilderError(`Operator '${operator}' bukan operator pencarian teks`);
  }
}

/**
 * One operator plus its raw value becomes one better-drizzle filter value:
 * `gte` + `2024-01-01` on a timestamp column becomes `{ gte: Date }`.
 */
function valueFor(column: Column, operator: FilterOperator, raw: string | string[]): FilterValue {
  const values = Array.isArray(raw) ? raw : parseList(raw);
  const single = values[0] ?? "";

  switch (operator) {
    case "eq":
      return values.length > 1
        ? { in: values.map((value) => coerce(column, value)) }
        : coerce(column, single);
    case "ne":
      return values.length > 1
        ? { notIn: values.map((value) => coerce(column, value)) }
        : { not: coerce(column, single) };
    case "in":
      return { in: values.map((value) => coerce(column, value)) };
    case "notIn":
      return { notIn: values.map((value) => coerce(column, value)) };
    case "contains":
    case "startsWith":
    case "endsWith":
      return pattern(operator, single);
    case "gt":
      return { gt: coerce(column, single) };
    case "gte":
      return { gte: coerce(column, single) };
    case "lt":
      return { lt: coerce(column, single) };
    case "lte":
      return { lte: coerce(column, single) };
    case "between": {
      const [min, max] = values as [string?, string?];
      if (min === undefined || max === undefined || values.length !== 2) {
        throw new QueryBuilderError(
          `Operator 'between' butuh dua nilai (min,max) untuk filter '${column.name}'`,
        );
      }
      return { gte: coerce(column, min), lte: coerce(column, max) };
    }
    case "null":
      return toBoolean(single) ? null : { not: null };
    default:
      throw new QueryBuilderError(`Operator '${operator}' tidak didukung`);
  }
}

/**
 * Turns one `filter[column]=...` entry into the filter values for that column.
 * `filter[a]=x` uses the default operator, `filter[a]=x,y` becomes an IN list,
 * and `filter[a][gte]=x` picks the operator explicitly.
 */
export function conditionsFor(name: string, column: Column, raw: unknown): FilterValue[] {
  const allowed = operatorsFor(column);

  if (typeof raw === "string") {
    const list = parseList(raw);
    if (list.length > 1) return [{ in: list.map((value) => coerce(column, value)) }];
    return [valueFor(column, defaultOperator(column), raw)];
  }
  if (Array.isArray(raw)) {
    return [valueFor(column, defaultOperator(column), raw.map((entry) => String(entry)))];
  }

  if (typeof raw !== "object" || raw === null) {
    throw new QueryBuilderError(`Filter '${name}' tidak valid`, { filter: name });
  }

  const conditions: FilterValue[] = [];
  for (const [operator, value] of Object.entries(raw)) {
    if (!isFilterOperator(operator) || !allowed.includes(operator)) {
      throw notAllowed(`Operator filter '${name}'`, operator, allowed);
    }
    const input = Array.isArray(value) ? value.map(String) : String(value);
    conditions.push(valueFor(column, operator, input));
  }

  if (conditions.length === 0) {
    throw new QueryBuilderError(`Filter '${name}' tidak punya operator`, { filter: name });
  }
  return conditions;
}
