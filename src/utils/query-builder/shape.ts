import type {
  IncludeInput,
  OrderByInput,
  PaginationArgs,
  QueryArgs,
  RelationKeysFor,
  ScalarKeysFor,
  SelectInput,
  SortOrder,
  WhereInput,
  AnySchema,
  TableKey,
} from "better-drizzle";
import type { FilterValue } from "./filters";

/**
 * TypeScript cannot build an object literal from a computed key and keep the
 * key's declared type: `{ [key]: value }` always widens to an index signature.
 * These helpers are the only place the query builder asserts a shape, and every
 * key passed in has already been checked against the allowlist.
 *
 * better-drizzle also declares two equivalent sort shapes — `OrderByInput` for
 * `findMany` and `OrderBy<SelectModelFor<…>>` for `paginate` — so the final
 * argument object is bridged once, here.
 */

/** One relation's query args inside an `include`/`select` projection, or `true`. */
export type RelationArg<S extends AnySchema, N extends TableKey<S>> =
  | true
  | NonNullable<IncludeInput<S, N>[Extract<RelationKeysFor<S, N>, string>]>;

/** One sort field map, e.g. `{ createdAt: "desc" }`. */
export type SortField<S extends AnySchema, N extends TableKey<S>> = {
  [K in ScalarKeysFor<S, N>]?: SortOrder;
};

/** SAFETY: `key` comes from an allowlisted column name. */
export function condition<S extends AnySchema, N extends TableKey<S>>(
  key: string,
  value: FilterValue,
): WhereInput<S, N> {
  // SAFETY: computed keys cannot carry the declared type, see the note above.
  return Object.assign({} as WhereInput<S, N>, { [key]: value });
}

/** SAFETY: every key comes from an allowlisted column name. */
export function selection<S extends AnySchema, N extends TableKey<S>>(
  keys: readonly string[],
): SelectInput<S, N> {
  // SAFETY: computed keys cannot carry the declared type, see the note above.
  const target = {} as SelectInput<S, N>;
  for (const key of keys) Object.assign(target, { [key]: true });
  return target;
}

/** SAFETY: `key` comes from an allowlisted sort name. */
export function sortField<S extends AnySchema, N extends TableKey<S>>(
  key: string,
  direction: SortOrder,
): SortField<S, N> {
  // SAFETY: computed keys cannot carry the declared type, see the note above.
  return Object.assign({} as SortField<S, N>, { [key]: direction });
}

/** SAFETY: `key` comes from an allowlisted relation name. */
export function relationEntry<S extends AnySchema, N extends TableKey<S>>(
  target: SelectInput<S, N> | IncludeInput<S, N>,
  key: string,
  value: RelationArg<S, N>,
): SelectInput<S, N> & IncludeInput<S, N> {
  // SAFETY: computed keys cannot carry the declared type, see the note above.
  return Object.assign(target, { [key]: value }) as SelectInput<S, N> & IncludeInput<S, N>;
}

/** SAFETY: AND/OR combinators live outside the mapped column half of `WhereInput`. */
export function allOf<S extends AnySchema, N extends TableKey<S>>(
  conditions: WhereInput<S, N>[],
): WhereInput<S, N> {
  // SAFETY: `AND` is a declared combinator, not a column key.
  return { AND: conditions } as WhereInput<S, N>;
}

/** SAFETY: AND/OR combinators live outside the mapped column half of `WhereInput`. */
export function anyOf<S extends AnySchema, N extends TableKey<S>>(
  conditions: WhereInput<S, N>[],
): WhereInput<S, N> {
  // SAFETY: `OR` is a declared combinator, not a column key.
  return { OR: conditions } as WhereInput<S, N>;
}

/** SAFETY: `OrderByInput` and paginate's `OrderBy` describe the same runtime list. */
export function paginationArgs<S extends AnySchema, N extends TableKey<S>>(
  args: QueryArgs<S, N>,
  page: number,
  perPage: number,
): PaginationArgs<S, N> {
  return { ...args, page, perPage } as PaginationArgs<S, N>;
}

/** SAFETY: the builder only ever emits scalar column keys here. */
export function orderByArgs<S extends AnySchema, N extends TableKey<S>>(
  fields: SortField<S, N>[],
): OrderByInput<S, N> {
  // SAFETY: `OrderByField` is a wider map that also allows relation keys.
  return fields as OrderByInput<S, N>;
}

/** SAFETY: `OrderByInput` and paginate's `OrderBy` describe the same runtime list. */
