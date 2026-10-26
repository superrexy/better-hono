import { getTableColumns } from "drizzle-orm";
import type { Column, Table } from "drizzle-orm";

/**
 * Public column name -> column for one table. Keyed by the property name
 * (`roleId`), which is what clients use and what `getTableColumns` returns,
 * so no schema information has to be repeated at call sites.
 */
export type ColumnMap = Map<string, Column>;

const cache = new WeakMap<Table, ColumnMap>();

export function columnsOf(table: Table): ColumnMap {
  const cached = cache.get(table);
  if (cached) return cached;

  const columns: ColumnMap = new Map();
  for (const [name, column] of Object.entries(getTableColumns(table))) columns.set(name, column);
  cache.set(table, columns);
  return columns;
}
