import "./env";
import { createRuntime } from "@/lib/runtime";
import type { Runtime } from "@/lib/runtime";
import { parseEnv } from "@/env";

/**
 * One runtime for the whole suite.
 *
 * The app normally builds a runtime per request, which is correct on Workers
 * (an I/O object cannot be reused across requests) but would open a new pg pool
 * for every single request in a test run. In Bun there is no such restriction,
 * so tests share one pool. createApp accepts this through its options.
 */
export const env = parseEnv(process.env as unknown as Record<string, string>);

export const runtime: Runtime = createRuntime(env);

export const db = runtime.db;
export const raw = runtime.raw;
export const auth = runtime.auth;
