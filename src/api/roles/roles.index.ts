import { createRouter } from '@/lib/create-app'
import { getRole, listRoles } from '@/api/roles/roles.handler'

const router = createRouter().openapiRoutes([listRoles, getRole])

export type RolesType = typeof router
export default router
