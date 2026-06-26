import express from 'express'
import cookieParser from 'cookie-parser'
import apiRouter from './routes'
import { errorHandler } from './middleware/error'

export function createApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/v1', apiRouter)
  app.use(errorHandler)
  return app
}
