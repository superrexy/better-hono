/**
 * Single source of truth for RBAC.
 *
 * Permissions and roles are declared in code so they stay type-safe, then the
 * seed script mirrors them into the `permission`, `role`, and `role_permission`
 * tables. Roles are never created through the API: add them here and re-seed.
 */

export const PERMISSIONS = [
  'users:read',
  'users:create',
  'users:update',
  'users:delete',
  'roles:read',
] as const

/** Every permission a route or service may ask for. */
export type Permission = (typeof PERMISSIONS)[number]

export interface RoleDefinition {
  readonly name: string
  readonly description: string
  readonly permissions: readonly Permission[]
}

export const ROLES = {
  admin: {
    name: 'Administrator',
    description: 'Full access to every resource',
    permissions: PERMISSIONS,
  },
  user: {
    name: 'User',
    description: 'Read-only access to the user directory',
    permissions: ['users:read'],
  },
} as const satisfies Record<string, RoleDefinition>

/** One user holds exactly one role. */
export type RoleName = keyof typeof ROLES

export const ROLE_NAMES = Object.keys(ROLES) as [RoleName, ...RoleName[]]

export const DEFAULT_ROLE: RoleName = 'user'

/** Role the bootstrap admin from `bun run db:seed` holds. */
export const ADMIN_ROLE: RoleName = 'admin'

const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSIONS)

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value)
}

export function isRoleName(value: string): value is RoleName {
  return Object.hasOwn(ROLES, value)
}

export function permissionsOf(role: RoleName): readonly Permission[] {
  return ROLES[role].permissions
}
