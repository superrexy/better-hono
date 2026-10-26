import type { BetterDrizzleModelDelegate, TableFor, TableKey } from "better-drizzle";
import type { Database } from "@/db";
import type { relations } from "@/db/relations";
import * as schema from "@/db/schema";
import type { QueryParams } from "./errors";
import { QueryBuilder, queryBuilder } from "./query-builder";
import type { QueryBuilderOptions } from "./query-builder";

/** The app's relation config — the single source of table names and columns. */
export type AppSchema = typeof relations;

/** Same keys as `db.user`, `db.role`, … */
type TableName = TableKey<AppSchema>;

/**
 * Mapped-type views of the client and the schema. Indexing these with a generic
 * key narrows to that one table, which indexing `Database` itself does not.
 */
type Delegates = { [K in TableName]: BetterDrizzleModelDelegate<AppSchema, K> };
type Tables = { [K in TableName]: TableFor<AppSchema, K> };

/**
 * Query builder bound to one request's `db` and one table. The table key is the
 * same key better-drizzle uses (`db.user`), so filters, sorts, fields and
 * includes are checked against the real columns at compile time.
 *
 * @example
 * const { data, pagination } = await qb(db, 'user', c.req.query())
 *   .allowedFilters('name', 'email', 'roleId')
 *   .allowedSorts('createdAt', 'name')
 *   .defaultSort('-createdAt')
 *   .execute();
 */
export function qb<Name extends TableName>(
  db: Database,
  table: Name,
  params: QueryParams,
  options: QueryBuilderOptions = {},
): QueryBuilder<AppSchema, Name> {
  // SAFETY: the delegate type carries plugin/extension parameters that only
  // exist on the client, so the client is viewed through its table map once.
  const delegates = db as unknown as Delegates;
  // SAFETY: `schema[K]` is exactly `TableFor<AppSchema, K>` for every table key.
  const tables = schema as unknown as Tables;
  return queryBuilder(delegates[table], tables[table], params, options);
}

export { QueryBuilder, queryBuilder } from "./query-builder";
export { QueryBuilderError } from "./errors";
export type { OffsetPage, QueryBuilderOptions, QueryResult } from "./query-builder";
export type { FilterOperator } from "./operators";
export type { QueryParams } from "./errors";
