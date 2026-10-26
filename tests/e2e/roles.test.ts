import { describe, expect, test } from "bun:test";
import { get } from "../helpers/app";
import { createAdmin } from "../helpers/fixtures";
import { PERMISSIONS, ROLES, ROLE_NAMES } from "@/lib/permissions";

describe("roles", () => {
  test("listing roles returns the seeded reference data", async () => {
    const admin = await createAdmin();

    const response = await get("/api/roles", { cookie: admin.cookie });

    expect(response.status).toBe(200);
    expect(response.body.map((role: { id: string }) => role.id).sort()).toEqual(
      [...ROLE_NAMES].sort(),
    );
  });

  test("each role reports exactly the permissions declared in code", async () => {
    const admin = await createAdmin();

    const response = await get("/api/roles", { cookie: admin.cookie });
    expect(response.status).toBe(200);

    for (const role of response.body) {
      const declared = ROLES[role.id as keyof typeof ROLES].permissions;
      const actual = role.permissions
        .map((permission: { id: string }) => permission.id)
        .sort();

      expect(actual).toEqual([...declared].sort());
    }
  });

  test("a single role can be read by id", async () => {
    const admin = await createAdmin();

    const response = await get("/api/roles/admin", { cookie: admin.cookie });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe("admin");
    expect(response.body.name).toBe("Administrator");
    expect(response.body.permissions.length).toBe(PERMISSIONS.length);
  });

  test("an unknown role id fails validation", async () => {
    const admin = await createAdmin();

    const response = await get("/api/roles/superuser", { cookie: admin.cookie });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation failed");
  });

  test("the same permission can belong to several roles", async () => {
    const admin = await createAdmin();

    const response = await get("/api/roles", { cookie: admin.cookie });
    const perRole = new Map<string, string[]>(
      response.body.map((role: { id: string; permissions: { id: string }[] }) => [
        role.id,
        role.permissions.map((permission) => permission.id),
      ]),
    );

    const shared = [...perRole.keys()].filter((roleId) => perRole.get(roleId)?.includes("users:read"));

    expect(shared.sort()).toEqual(["admin", "user"]);
  });
});
