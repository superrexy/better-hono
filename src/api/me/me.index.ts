import { createRouter } from '@/lib/create-app'
import { me } from '@/api/me/me.handler'

const router = createRouter().openapiRoutes([me])

export type MeType = typeof router
export default router
