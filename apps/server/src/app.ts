import express from 'express'
import cookieParser from 'cookie-parser'
import apiRouter from './routes'

export function createApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/v1', apiRouter)
  return app
}
