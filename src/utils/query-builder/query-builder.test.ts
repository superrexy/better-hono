import { describe, expect, test } from "bun:test";
import { better } from "better-drizzle";
import { timestamps } from "better-drizzle/timestamps";
import { zod } from "better-drizzle/zod";
import { drizzle } from "drizzle-orm/node-postgres";
import { relations } from "@/db/relations";
import { qb } from "./index";
import { QueryBuilderError } from "./errors";
import type { QueryParams } from "./errors";

/** Mirrors `createDb` from `@/db`, without a database connection. */
const db = better(drizzle.mock({ relations }), {
  plugins: [
    timestamps(),
    zod({ validate: { result: true, create: false, update: false, upsert: false } }),
  ],
});

function build(params: QueryParams = {}, options = {}) {
  return qb(db, "user", params, options)
    .allowedFilters("name", "email", "roleId", "emailVerified", "createdAt")
    .allowedSorts("name", "email", "createdAt")
    .allowedFields("id", "name", "email", "roleId", "createdAt")
    .allowedIncludes({ role: { select: { id: true, name: true } } });
}

describe("query builder", () => {
  test("an empty query builds no where, order or projection", () => {
    const builder = qb(db, "user", {}).allowedFilters("email").allowedSorts("email");

    expect(builder.toWhere()).toBeUndefined();
    expect(builder.toOrderBy()).toBeUndefined();
    expect(builder.toProjection()).toEqual({});
    expect(builder.toDebug()).toEqual({ page: 1, perPage: 20 });
  });

  test("declaring fields pins the scalar projection", () => {
    expect(build().toProjection()).toEqual({
      select: { id: true, name: true, email: true, roleId: true, createdAt: true },
    });
  });

  test("a bare string filter becomes a case-insensitive contains", () => {
    expect(build({ "filter[name]": "adm" }).toWhere()).toEqual({
      name: { contains: "adm", mode: "insensitive" },
    });
  });

  test("a comma list becomes IN", () => {
    expect(build({ "filter[roleId]": "admin,user" }).toWhere()).toEqual({
      roleId: { in: ["admin", "user"] },
    });
  });

  test("operators follow the column type", () => {
    expect(build({ "filter[email][startsWith]": "a" }).toWhere()).toEqual({
      email: { startsWith: "a", mode: "insensitive" },
    });
    expect(build({ "filter[emailVerified]": "true" }).toWhere()).toEqual({
      emailVerified: true,
    });
  });

  test("dates are coerced before they reach the driver", () => {
    const where = build({ "filter[createdAt][gte]": "2024-01-01" }).toWhere();
    expect(where).toEqual({ createdAt: { gte: new Date("2024-01-01") } });
  });

  test("several filters are ANDed", () => {
    const where = build({ "filter[roleId][eq]": "admin", "filter[emailVerified]": "true" }).toWhere();

    expect(where).toEqual({
      AND: [{ roleId: "admin" }, { emailVerified: true }],
    });
  });

  test("filter[or][...] groups its members", () => {
    const where = build({
      "filter[or][email]": "a@b.c",
      "filter[or][name]": "Ann",
    }).toWhere();

    expect(where).toEqual({
      OR: [
        { email: { contains: "a@b.c", mode: "insensitive" } },
        { name: { contains: "Ann", mode: "insensitive" } },
      ],
    });
  });

  test("guarded scope is ANDed with the client filters and survives it", () => {
    const where = build({ "filter[name]": "adm" })
      .guard({ roleId: "user" })
      .toWhere();

    expect(where).toEqual({
      AND: [{ roleId: "user" }, { name: { contains: "adm", mode: "insensitive" } }],
    });
  });

  test("sort parses direction, and defaultSort fills the gap", () => {
    const builder = build({ sort: "-createdAt,name" });
    expect(builder.toOrderBy()).toEqual([{ createdAt: "desc" }, { name: "asc" }]);

    const fallback = build({}).defaultSort("-createdAt");
    expect(fallback.toOrderBy()).toEqual([{ createdAt: "desc" }]);
  });

  test("fields narrows the projection, include adds the relation", () => {
    expect(build({ fields: "id,email" }).toProjection()).toEqual({
      select: { id: true, email: true },
    });

    expect(build({ include: "role" }).toProjection()).toEqual({
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });
  });

  test("defaultInclude applies when the client asks for nothing", () => {
    const projection = build({}, { defaultInclude: ["role"] }).toProjection();
    expect(projection.select).toHaveProperty("role");
  });

  test("pagination defaults, and perPage is capped", () => {
    expect(build({ page: "2", perPage: "5" }).toDebug()).toMatchObject({ page: 2, perPage: 5 });

    expect(() => build({ perPage: "500" }).toDebug()).toThrow(QueryBuilderError);
    expect(() => build({ page: "0" }).toDebug()).toThrow(QueryBuilderError);
  });

  test("anything outside the allowlist is a 400", () => {
    const rejected = (params: QueryParams) => () => build(params).toDebug();

    expect(rejected({ "filter[image]": "x" })).toThrow(QueryBuilderError);
    expect(rejected({ sort: "image" })).toThrow(QueryBuilderError);
    expect(rejected({ fields: "image" })).toThrow(QueryBuilderError);
    expect(rejected({ include: "sessions" })).toThrow(QueryBuilderError);
    expect(rejected({ "filter[createdAt][contains]": "2024" })).toThrow(QueryBuilderError);
    expect(rejected({ "filter[createdAt][gte]": "not-a-date" })).toThrow(QueryBuilderError);
    expect(rejected({ "filter[emailVerified]": "maybe" })).toThrow(QueryBuilderError);
  });

  test("the error carries status 400 so onError answers it directly", () => {
    try {
      build({ sort: "nope" }).toOrderBy();
      throw new Error("expected a QueryBuilderError");
    } catch (error) {
      expect(error).toBeInstanceOf(QueryBuilderError);
      expect((error as QueryBuilderError).status).toBe(400);
    }
  });
});
