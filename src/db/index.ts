import { better } from "better-drizzle";
import { timestamps } from "better-drizzle/timestamps";
import { zod } from "better-drizzle/zod";
import { drizzle } from "drizzle-orm/node-postgres";
import { Environment } from '@/env';
import { relations } from "@/db/relations";

/**
 * Connections are request-scoped on purpose: Cloudflare Workers forbid reusing
 * an I/O object across requests, so a module-level cache would make the first
 * request work and every later one hang. Call this once per request and pass
 * the result through the context.
 *
 * Raw Drizzle client: better-auth's drizzleAdapter needs a plain Drizzle
 * instance, so auth keeps using this one.
 */
export function createDrizzle(env: Environment) {
    return drizzle({
        connection: env.DATABASE_URL,
        relations,
    });
}

/** better-drizzle client: one typed delegate per table (`db.user`, `db.session`, ...). */
export function createDb(env: Environment, raw: RawDatabase = createDrizzle(env)) {
    return better(raw, {
        plugins: [
            timestamps(),
            /**
             * Payloads are validated at the route edge with zValidator, so the
             * plugin only has to leave writes untouched.
             */
            zod({ validate: { result: true, create: false, update: false, upsert: false } }),
        ],
    });
}

export type RawDatabase = ReturnType<typeof createDrizzle>;
export type Database = ReturnType<typeof createDb>;
