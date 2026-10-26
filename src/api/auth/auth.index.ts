import { createRouter } from '@/lib/create-app'

const router = createRouter().all('/**', (c) => c.get('authApi').handler(c.req.raw))

export default router
