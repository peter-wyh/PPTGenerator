import { Router } from 'express'
import authRoutes from '../modules/auth/auth.routes'
import usersRoutes from '../modules/users/users.routes'
import projectsRoutes from '../modules/projects/projects.routes'

const api = Router()

api.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

api.use('/auth', authRoutes)
api.use('/admin/users', usersRoutes)
api.use('/projects', projectsRoutes)

export default api
