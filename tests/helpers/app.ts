import { createServerApp } from "@/app";
import { runtime } from "./runtime";

/**
 * The full app under test, with one shared runtime for the whole run.
 *
 * `createServerApp` normally builds a runtime per request (required on Workers).
 * Here every request reuses the same pool, which keeps the suite fast without
 * changing production behaviour.
 */
export const app = createServerApp({ createRuntime: () => runtime });

export interface RequestOptions {
  cookie?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface TestResponse {
  status: number;
  body: any;
  /** `name=value; other=value` pair suitable for the next request. */
  cookie: string;
  headers: Headers;
}

/**
 * Calls the app in-process (no socket, no wrangler) and returns the cookie pair
 * from `set-cookie` so a caller can carry a session to the next request.
 */
export async function request(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<TestResponse> {
  const headers = new Headers(options.headers);

  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);

  const response = await app.request(`http://localhost:3000${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .filter(Boolean)
    .join("; ");

  const text = await response.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { status: response.status, body, cookie, headers: response.headers };
}

export const get = (path: string, options?: RequestOptions) => request("GET", path, options);
export const post = (path: string, options?: RequestOptions) => request("POST", path, options);
export const patch = (path: string, options?: RequestOptions) => request("PATCH", path, options);
export const del = (path: string, options?: RequestOptions) => request("DELETE", path, options);
