import { Router } from 'express'
import authRoutes from '../modules/auth/auth.routes'

const api = Router()

api.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

api.use('/auth', authRoutes)

export default api
