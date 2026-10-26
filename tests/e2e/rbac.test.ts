import { describe, expect, test } from "bun:test";
import { get, patch, post } from "../helpers/app";
import { createAdmin, createUser } from "../helpers/fixtures";
import { PERMISSIONS, permissionsOf } from "@/lib/permissions";

describe("authorization", () => {
  test("protected routes answer 401 without a session", async () => {
    const responses = await Promise.all([
      get("/api/me"),
      get("/api/users"),
      get("/api/roles"),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Authentication required");
    }
  });

  test("a user-role session may read users but not write them", async () => {
    const user = await createUser({ role: "user" });

    const list = await get("/api/users", { cookie: user.cookie });
    expect(list.status).toBe(200);

    const create = await post("/api/users", {
      cookie: user.cookie,
      body: { email: "denied@example.test", name: "Denied" },
    });
    expect(create.status).toBe(403);
    expect(create.body.message).toBe("Missing permission: users:create");
  });

  test("roles are unreadable for a user-role session", async () => {
    const user = await createUser({ role: "user" });

    const response = await get("/api/roles", { cookie: user.cookie });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Missing permission: roles:read");
  });

  test("an admin session holds every permission", async () => {
    const admin = await createAdmin();

    const me = await get("/api/me", { cookie: admin.cookie });

    expect(me.status).toBe(200);
    expect(me.body.role).toBe("admin");
    expect(me.body.permissions.sort()).toEqual([...permissionsOf("admin")].sort());
    expect(me.body.permissions.length).toBe(PERMISSIONS.length);
  });

  test("a role change applies to the next request", async () => {
    const user = await createUser({ role: "user" });
    const admin = await createAdmin();

    const before = await get("/api/roles", { cookie: user.cookie });
    expect(before.status).toBe(403);

    const updated = await patch(`/api/users/${user.id}`, {
      cookie: admin.cookie,
      body: { roleId: "admin" },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.roleId).toBe("admin");

    // Permissions are resolved per request, so the old cookie now acts as admin.
    const after = await get("/api/roles", { cookie: user.cookie });
    expect(after.status).toBe(200);
  });

  test("every role's declared permissions match what /api/me reports", async () => {
    const admin = await createAdmin();
    const member = await createUser({ role: "user" });

    const [adminMe, memberMe] = await Promise.all([
      get("/api/me", { cookie: admin.cookie }),
      get("/api/me", { cookie: member.cookie }),
    ]);

    expect(adminMe.body.permissions.sort()).toEqual([...permissionsOf("admin")].sort());
    expect(memberMe.body.permissions.sort()).toEqual([...permissionsOf("user")].sort());
  });
});
