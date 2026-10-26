import { describe, expect, test } from "bun:test";
import { app } from "../helpers/app";
import { get } from "../helpers/app";

const base = "http://localhost:3000";

describe("health", () => {
  test("GET / returns the app banner", async () => {
    const response = await get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "App API" });
  });

  test("unknown route returns a 404 envelope naming the path", async () => {
    const response = await get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("/does-not-exist");
  });
});

describe("HEAD requests", () => {
  /**
   * Hono rewrites HEAD to GET before route matching and strips the body, so the
   * contract is: same status, same headers, no body. A dedicated `app.head()`
   * route would never run, which is why none exists.
   */
  test("HEAD / mirrors the GET status and headers with no body", async () => {
    const getRes = await app.request(`${base}/`);
    const headRes = await app.request(`${base}/`, { method: "HEAD" });

    expect(headRes.status).toBe(getRes.status);
    expect(headRes.headers.get("content-type")).toBe(getRes.headers.get("content-type"));
    expect(headRes.body).toBe(null);
  });

  test("HEAD on a guarded route keeps the GET status", async () => {
    const getRes = await app.request(`${base}/api/users`);
    const headRes = await app.request(`${base}/api/users`, { method: "HEAD" });

    expect(getRes.status).toBe(401);
    expect(headRes.status).toBe(getRes.status);
    expect(headRes.body).toBe(null);
  });
});
