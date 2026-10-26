import { index, pgTable, primaryKey, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { DEFAULT_ROLE } from "@/lib/permissions";

export const role = pgTable("role", {
    /** Role slug, e.g. `admin`. Mirrors the keys of `ROLES` in src/lib/permissions.ts. */
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull()
});

export const permission = pgTable("permission", {
    /** Permission string, e.g. `users:read`. Mirrors `PERMISSIONS` in src/lib/permissions.ts. */
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull()
});

export const rolePermission = pgTable("role_permission", {
    roleId: text('role_id').notNull().references(() => role.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id').notNull().references(() => permission.id, { onDelete: 'cascade' })
}, (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
    index('role_permission_permission_id_idx').on(t.permissionId),
]);

export const user = pgTable("user", {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull(),
    image: text('image'),
    roleId: text('role_id').notNull().default(DEFAULT_ROLE).references(() => role.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull()
}, (t) => [
    index('user_role_id_idx').on(t.roleId),
]);

export const session = pgTable("session", {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' })
});

export const account = pgTable("account", {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull()
});

export const verification = pgTable("verification", {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at')
});
