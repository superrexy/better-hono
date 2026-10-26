import { describe, expect, test } from "bun:test";
import { del, get, patch, post } from "../helpers/app";
import { createAdmin, createUser, uniqueEmail } from "../helpers/fixtures";

describe("users", () => {
  test("creating a user returns it with the requested role", async () => {
    const admin = await createAdmin();
    const email = uniqueEmail("created");

    const created = await post("/api/users", {
      cookie: admin.cookie,
      body: { email, name: "Created User", roleId: "admin" },
    });

    expect(created.status).toBe(201);
    expect(created.body.email).toBe(email);
    expect(created.body.roleId).toBe("admin");
    expect(created.body.role).toEqual({ id: "admin", name: "Administrator" });
    // Never leak credential material.
    expect(created.body).not.toHaveProperty("password");
    expect(created.body).not.toHaveProperty("account");
  });

  test("a user created without a password can only get in by OTP", async () => {
    const admin = await createAdmin();
    const email = uniqueEmail("passwordless");

    const created = await post("/api/users", {
      cookie: admin.cookie,
      body: { email, name: "No Password" },
    });
    expect(created.status).toBe(201);
    expect(created.body.roleId).toBe("user");

    // No password was set, so an empty password must not authenticate.
    const passwordAttempt = await post("/api/auth/sign-in/email", {
      body: { email, password: "" },
    });
    expect(passwordAttempt.status).toBeOneOf([400, 401]);

    // OTP does work for that same account.
    const requested = await post("/api/auth/email-otp/send-verification-otp", {
      body: { email, type: "sign-in" },
    });
    expect(requested.status).toBe(200);
  });

  test("a duplicate email is rejected with 409", async () => {
    const admin = await createAdmin();
    const existing = await createUser({ role: "user" });

    const created = await post("/api/users", {
      cookie: admin.cookie,
      body: { email: existing.email, name: "Duplicate" },
    });

    expect(created.status).toBe(409);
    expect(created.body.message).toContain("already registered");
  });

  test("invalid payloads are rejected with field-level issues", async () => {
    const admin = await createAdmin();

    const badEmail = await post("/api/users", {
      cookie: admin.cookie,
      body: { email: "not-an-email", name: "X" },
    });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.message).toBe("Validation failed");
    expect(badEmail.body.issues[0].path).toBe("email");

    const badRole = await post("/api/users", {
      cookie: admin.cookie,
      body: { email: uniqueEmail("badrole"), name: "X", roleId: "superuser" },
    });
    expect(badRole.status).toBe(400);
    expect(badRole.body.issues[0].path).toBe("roleId");

    const missingName = await post("/api/users", {
      cookie: admin.cookie,
      body: { email: uniqueEmail("noname") },
    });
    expect(missingName.status).toBe(400);
    expect(missingName.body.issues[0].path).toBe("name");
  });

  test("reading a user by id, then updating the name", async () => {
    const admin = await createAdmin();
    const target = await createUser({ role: "user" });

    const read = await get(`/api/users/${target.id}`, { cookie: admin.cookie });
    expect(read.status).toBe(200);
    expect(read.body.id).toBe(target.id);

    const updated = await patch(`/api/users/${target.id}`, {
      cookie: admin.cookie,
      body: { name: "Renamed" },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe("Renamed");
    expect(updated.body.email).toBe(target.email);
  });

  test("an empty update body fails validation", async () => {
    const admin = await createAdmin();
    const target = await createUser({ role: "user" });

    const response = await patch(`/api/users/${target.id}`, {
      cookie: admin.cookie,
      body: {},
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation failed");
  });

  test("an unknown id answers 404", async () => {
    const admin = await createAdmin();

    const read = await get("/api/users/nope", { cookie: admin.cookie });
    expect(read.status).toBe(404);
    expect(read.body.message).toContain("not found");
  });

  test("deleting a user removes it", async () => {
    const admin = await createAdmin();
    const target = await createUser({ role: "user" });

    const removed = await del(`/api/users/${target.id}`, { cookie: admin.cookie });
    expect(removed.status).toBe(200);
    expect(removed.body.id).toBe(target.id);

    const read = await get(`/api/users/${target.id}`, { cookie: admin.cookie });
    expect(read.status).toBe(404);
  });

  test("an admin cannot delete their own account", async () => {
    const admin = await createAdmin();

    const response = await del(`/api/users/${admin.id}`, { cookie: admin.cookie });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("You cannot delete your own account");
  });

  test("listing paginates and filters by search and role", async () => {
    const admin = await createAdmin();

    const list = await get("/api/users?page=1&perPage=2", { cookie: admin.cookie });
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeLessThanOrEqual(2);
    expect(list.body.pagination).toMatchObject({ page: 1, perPage: 2 });
    expect(list.body.pagination.total).toBeGreaterThan(0);
    // The role relation is included by default.
    expect(list.body.data[0].role).toMatchObject({ id: expect.any(String) });

    // Scoped to this test's own user, so it is concurrency-safe.
    const target = await createUser({ role: "user", name: "Findable Person" });
    const searched = await get(
      `/api/users?filter[or][email]=${encodeURIComponent(target.email)}&filter[or][name]=Findable`,
      { cookie: admin.cookie },
    );
    expect(searched.status).toBe(200);
    expect(searched.body.data.map((row: { email: string }) => row.email)).toContain(target.email);

    const byRole = await get("/api/users?filter[roleId][eq]=admin", { cookie: admin.cookie });
    expect(byRole.status).toBe(200);
    expect(byRole.body.data.length).toBeGreaterThan(0);
    expect(byRole.body.data.every((row: { roleId: string }) => row.roleId === "admin")).toBe(true);

    const sorted = await get("/api/users?sort=-email&fields=id,email", { cookie: admin.cookie });
    expect(sorted.status).toBe(200);
    expect(Object.keys(sorted.body.data[0]).toSorted()).toEqual(["email", "id"]);
  });

  test("rejects pagination and filters outside the allowlist", async () => {
    const admin = await createAdmin();

    const tooBig = await get("/api/users?perPage=500", { cookie: admin.cookie });
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.message).toContain("perPage");

    const notAllowed = await get("/api/users?filter[accountId]=1", { cookie: admin.cookie });
    expect(notAllowed.status).toBe(400);
    expect(notAllowed.body.message).toContain("tidak diizinkan");

    const badSort = await get("/api/users?sort=password", { cookie: admin.cookie });
    expect(badSort.status).toBe(400);
  });
});
