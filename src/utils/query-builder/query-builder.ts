import type {
  AnySchema,
  BetterDrizzleModelDelegate,
  IncludeInput,
  OrderByInput,
  QueryArgs,
  ScalarKeysFor,
  SelectInput,
  SelectModelFor,
  TableFor,
  TableKey,
  WhereInput,
} from "better-drizzle";
import type { Column } from "drizzle-orm";
import { columnsOf } from "./columns";
import { QueryBuilderError, notAllowed } from "./errors";
import type { QueryParams } from "./errors";
import { conditionsFor } from "./filters";
import { parseQueryParams, parseList, scalarParam } from "./params";
import type { ParsedParams } from "./params";
import {
  allOf,
  anyOf,
  condition,
  orderByArgs,
  paginationArgs,
  relationEntry,
  selection,
  sortField,
} from "./shape";
import type { RelationArg, SortField } from "./shape";

/** A column the client may reference by its property name (`roleId`). */
type ScalarKey<Schema extends AnySchema, Name extends TableKey<Schema>> = Extract<
  ScalarKeysFor<Schema, Name>,
  string
>;

export interface OffsetPage {
  page: number;
  perPage: number;
  total: number;
  pageCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Rows are `Partial` because `?fields=` can narrow the projection, and included
 * relations appear as extra keys.
 */
export interface QueryResult<Schema extends AnySchema, Name extends TableKey<Schema>> {
  data: Partial<SelectModelFor<Schema, Name>>[];
  pagination: OffsetPage | null;
}

export interface QueryBuilderOptions {
  /** Sort applied when the client sends no `sort`, e.g. `-createdAt`. */
  defaultSort?: string;
  /** Page size when the client sends no `perPage`. Default 20. */
  defaultPerPage?: number;
  /** Largest accepted `perPage`. Default 100. */
  maxPerPage?: number;
  /** Offset pagination. Set `false` for a plain `findMany`. Default true. */
  paginate?: boolean;
  /** Relations included when the client sends no `include`, e.g. `['role']`. */
  defaultInclude?: string[];
}

/**
 * Spatie-style query builder over better-drizzle delegates. Every feature is
 * opt-in: a filter, sort, include or field that is not allowlisted throws a
 * `QueryBuilderError` (400) instead of reaching the database. Operators are
 * derived from the column type, so no per-column configuration is needed.
 *
 * @example
 * const { data, pagination } = await queryBuilder(db.user, user, c.req.query())
 *   .allowedFilters('name', 'email', 'roleId')
 *   .allowedSorts('name', 'createdAt')
 *   .allowedFields('id', 'name', 'email', 'roleId', 'createdAt')
 *   .allowedIncludes({ role: { select: { id: true, name: true } } })
 *   .defaultSort('-createdAt')
 *   .execute();
 */
export class QueryBuilder<Schema extends AnySchema, Name extends TableKey<Schema>> {
  private readonly delegate: BetterDrizzleModelDelegate<Schema, Name>;
  private readonly table: TableFor<Schema, Name>;
  private readonly parsed: ParsedParams;
  private readonly options: QueryBuilderOptions;

  private readonly filters = new Map<string, Column>();
  private readonly sorts = new Map<string, Column>();
  private readonly fields = new Map<string, Column>();
  private readonly includes = new Map<string, RelationArg<Schema, Name>>();
  private readonly guards: WhereInput<Schema, Name>[] = [];

  constructor(
    delegate: BetterDrizzleModelDelegate<Schema, Name>,
    table: TableFor<Schema, Name>,
    params: QueryParams,
    options: QueryBuilderOptions = {},
  ) {
    this.delegate = delegate;
    this.table = table;
    this.parsed = parseQueryParams(params);
    this.options = options;
  }

  // -- allowlist -------------------------------------------------------------

  /** `?filter[<name>]=...`. Operators come from the column type. */
  allowedFilters(...names: ScalarKey<Schema, Name>[]): this {
    this.addColumns(this.filters, names);
    return this;
  }

  /** `?sort=<name>` and `?sort=-<name>`. */
  allowedSorts(...names: ScalarKey<Schema, Name>[]): this {
    this.addColumns(this.sorts, names);
    return this;
  }

  /** `?fields=id,name`. Declaring any field pins the scalar projection. */
  allowedFields(...names: ScalarKey<Schema, Name>[]): this {
    this.addColumns(this.fields, names);
    return this;
  }

  /** `?include=role`. The query args per relation are server-side only. */
  allowedIncludes(config: IncludeInput<Schema, Name>): this {
    for (const name of Object.keys(config)) this.includes.set(name, relationArg(config, name));
    return this;
  }

  /** Sort used when the client sends no `sort`. */
  defaultSort(sort: string): this {
    this.options.defaultSort = sort;
    return this;
  }

  /** Condition the client cannot remove, e.g. a tenant or ownership scope. */
  guard(where: WhereInput<Schema, Name> | WhereInput<Schema, Name>[]): this {
    this.guards.push(...(Array.isArray(where) ? where : [where]));
    return this;
  }

  // -- pieces ----------------------------------------------------------------

  /** WHERE from guarded scope, filters and the `filter[or][...]` group. */
  toWhere(): WhereInput<Schema, Name> | undefined {
    const conditions: WhereInput<Schema, Name>[] = [...this.guards];
    const orGroup: WhereInput<Schema, Name>[] = [];
    const tree = isRecord(this.parsed.filter) ? this.parsed.filter : {};

    for (const [name, value] of Object.entries(tree)) {
      if (name === "or") {
        for (const [key, member] of Object.entries(isRecord(value) ? value : {})) {
          orGroup.push(...this.filterConditions(key, member));
        }
        continue;
      }
      conditions.push(...this.filterConditions(name, value));
    }

    if (orGroup.length > 0) conditions.push(anyOf(orGroup));
    if (conditions.length === 0) return undefined;
    return conditions.length === 1 ? conditions[0] : allOf(conditions);
  }

  /** ORDER BY, or `undefined` when nothing was asked for and no default exists. */
  toOrderBy(): OrderByInput<Schema, Name> | undefined {
    const requested = scalarParam(this.parsed, "sort") ?? this.options.defaultSort;
    if (!requested) return undefined;

    const entries: SortField<Schema, Name>[] = [];
    for (const token of parseList(requested)) {
      const descending = token.startsWith("-");
      const name = descending ? token.slice(1) : token;
      this.columnOf(this.sorts, "Sort", name);
      entries.push(sortField(name, descending ? "desc" : "asc"));
    }
    return orderByArgs(entries);
  }

  /** Projection from `?fields=` and `?include=`. */
  toProjection(): Pick<QueryArgs<Schema, Name>, "select"> {
    const requestedFields = scalarParam(this.parsed, "fields");
    const requestedIncludes = this.requestedIncludes();

    let fieldKeys: string[] = [];
    if (requestedFields) {
      fieldKeys = parseList(requestedFields).map((name) => {
        this.columnOf(this.fields, "Field", name);
        return name;
      });
    } else if (this.fields.size > 0) {
      fieldKeys = [...this.fields.keys()];
    }

    if (requestedIncludes.length === 0 && fieldKeys.length === 0) return {};

    const select: SelectInput<Schema, Name> = selection(fieldKeys);
    for (const name of requestedIncludes) relationEntry(select, name, this.includes.get(name) ?? true);
    return { select };
  }

  /** Ready-to-use args for `findMany` / `paginate`. */
  toArgs(): QueryArgs<Schema, Name> {
    const args: QueryArgs<Schema, Name> = {};
    const where = this.toWhere();
    const orderBy = this.toOrderBy();
    const projection = this.toProjection();

    if (where !== undefined) Object.assign(args, { where });
    if (orderBy !== undefined) Object.assign(args, { orderBy });
    if (projection.select !== undefined) Object.assign(args, { select: projection.select });
    return args;
  }

  // -- execution -------------------------------------------------------------

  /** Runs the query: offset pagination by default, `findMany` when disabled. */
  async execute(): Promise<QueryResult<Schema, Name>> {
    if (this.options.paginate === false) {
      const data = await this.delegate.findMany(this.toArgs());
      return { data, pagination: null };
    }

    const { page, perPage } = this.paging();
    const { data, pagination } = await this.delegate.paginate(
      paginationArgs(this.toArgs(), page, perPage),
    );
    return { data, pagination };
  }

  /** Total matching rows for the current filters, without reading them. */
  async count(): Promise<number> {
    return this.delegate.count({ where: this.toWhere() });
  }

  /** Debug view of the parsed request; never runs SQL. */
  toDebug(): Record<string, unknown> {
    return {
      where: this.toWhere(),
      orderBy: this.toOrderBy(),
      select: this.toProjection().select,
      ...this.paging(),
    };
  }

  // -- internals -------------------------------------------------------------

  private addColumns(target: Map<string, Column>, names: readonly string[]): void {
    for (const name of names) {
      const column = columnsOf(this.table).get(name);
      if (!column) {
        throw new QueryBuilderError(
          `Kolom '${name}' tidak ada di tabel '${this.delegate.$model.name}', pakai nama properti tabel`,
        );
      }
      target.set(name, column);
    }
  }

  private columnOf(target: Map<string, Column>, kind: string, name: string): Column {
    const column = target.get(name);
    if (!column) throw notAllowed(kind, name, target.keys());
    return column;
  }

  private filterConditions(name: string, value: unknown): WhereInput<Schema, Name>[] {
    const column = this.columnOf(this.filters, "Filter", name);
    return conditionsFor(name, column, value).map((filter) => condition(name, filter));
  }

  private requestedIncludes(): string[] {
    const raw = scalarParam(this.parsed, "include");
    const defaults = scalarParam(this.parsed, "fields") ? [] : (this.options.defaultInclude ?? []);
    const names = raw ? parseList(raw) : defaults;
    for (const name of names) {
      if (!this.includes.has(name)) throw notAllowed("Include", name, this.includes.keys());
    }
    return names;
  }

  private paging(): { page: number; perPage: number } {
    const perPage = this.intParam("perPage") ?? this.options.defaultPerPage ?? 20;
    const maxPerPage = this.options.maxPerPage ?? 100;
    const page = this.intParam("page") ?? 1;

    if (perPage > maxPerPage) {
      throw new QueryBuilderError(`perPage maksimal ${maxPerPage}`, { perPage, maxPerPage });
    }
    return { page, perPage };
  }

  private intParam(key: string): number | undefined {
    const raw = scalarParam(this.parsed, key);
    if (raw === undefined) return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) {
      throw new QueryBuilderError(`Parameter '${key}' harus bilangan bulat >= 1`, { [key]: raw });
    }
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** SAFETY: `name` is one of the config's own keys, read back by `Object.keys`. */
function relationArg<S extends AnySchema, N extends TableKey<S>>(
  config: IncludeInput<S, N>,
  name: string,
): RelationArg<S, N> {
  const record = config as Record<string, RelationArg<S, N> | undefined>;
  return record[name] ?? true;
}

/**
 * Creates a builder for one table. `table` is only used for column metadata
 * (types and nullability), so the allowlists can stay plain property names.
 */
export function queryBuilder<Schema extends AnySchema, Name extends TableKey<Schema>>(
  delegate: BetterDrizzleModelDelegate<Schema, Name>,
  table: TableFor<Schema, Name>,
  params: QueryParams,
  options: QueryBuilderOptions = {},
): QueryBuilder<Schema, Name> {
  return new QueryBuilder(delegate, table, params, options);
}
