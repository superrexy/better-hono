import { describe, expect, test } from "bun:test";
import { app, get } from "../helpers/app";
import { TEST_AUTH_URL } from "../helpers/env";

const base = "http://localhost:3000";

describe("openapi document", () => {
  test("GET /doc describes every route module", async () => {
    const response = await get("/doc");

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.servers).toEqual([{ url: TEST_AUTH_URL }]);
    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining([
        "/api/me",
        "/api/users",
        "/api/users/{id}",
        "/api/roles",
        "/api/roles/{id}",
      ]),
    );
  });

  test("better-auth's routes are merged under /api/auth", async () => {
    const { body } = await get("/doc");

    const authPaths = Object.keys(body.paths).filter((path) => path.startsWith("/api/auth/"));
    expect(authPaths).toContain("/api/auth/sign-in/email");
    expect(authPaths).toContain("/api/auth/sign-in/email-otp");
    expect(authPaths).toContain("/api/auth/sign-up/email");
    // Nothing may leak at the auth root, where the app has no routes.
    expect(Object.keys(body.paths)).not.toContain("/sign-in/email");
  });

  test("better-auth's component schemas are namespaced so they cannot shadow ours", async () => {
    const { body } = await get("/doc");
    const schemas = Object.keys(body.components.schemas);

    // Ours, unprefixed.
    expect(schemas).toContain("User");
    expect(schemas).toContain("Role");
    expect(schemas).toContain("ValidationError");
    // better-auth's, prefixed.
    expect(schemas).toContain("AuthUser");
    expect(schemas).toContain("AuthSession");
    expect(JSON.stringify(body.paths["/api/auth/sign-in/email"])).toContain(
      "#/components/schemas/AuthUser",
    );
  });

  test("route guards are described, not lost", async () => {
    const { body } = await get("/doc");
    const getUser = body.paths["/api/users/{id}"].get;

    expect(getUser.tags).toEqual(["Users"]);
    expect(Object.keys(getUser.responses)).toEqual(
      expect.arrayContaining(["200", "401", "403", "404"]),
    );
    expect(getUser.parameters[0]).toMatchObject({ name: "id", in: "path", required: true });
  });

  test("the docs routes are not themselves part of the document", async () => {
    const { body } = await get("/doc");

    expect(Object.keys(body.paths)).not.toContain("/doc");
    expect(Object.keys(body.paths)).not.toContain("/reference");
  });

  test("HEAD /doc mirrors GET with no body", async () => {
    const getRes = await app.request(`${base}/doc`);
    const headRes = await app.request(`${base}/doc`, { method: "HEAD" });

    expect(headRes.status).toBe(getRes.status);
    expect(headRes.body).toBe(null);
  });
});

describe("scalar reference", () => {
  test("GET /reference renders the Scalar UI against /doc", async () => {
    const response = await get("/reference");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.body).toContain("api-reference");
    expect(response.body).toContain("/doc");
  });
});
