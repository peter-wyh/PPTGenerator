import { Router } from 'express'
import authRoutes from '../modules/auth/auth.routes'
import usersRoutes from '../modules/users/users.routes'

const api = Router()

api.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

api.use('/auth', authRoutes)
api.use('/admin/users', usersRoutes)

export default api
