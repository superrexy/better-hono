import { createRouter } from '@/lib/create-app'
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from '@/api/users/users.handler'

/**
 * Chained so `typeof router` carries every route: that is what makes
 * `export type UsersType` usable by an RPC client.
 *
 * `openapiRoutes` adds the routes AND registers each `createRoute()` object in
 * the OpenAPI registry, which is what puts this module in `/doc`.
 */
const router = createRouter().openapiRoutes([
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
])

export type UsersType = typeof router
export default router
