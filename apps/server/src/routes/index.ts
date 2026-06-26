import { Router } from 'express'

const api = Router()

api.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

export default api
