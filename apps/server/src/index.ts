import { createApp } from './app'
import { config } from './config'
import { logger } from './logger'

const app = createApp()
app.listen(config.PORT, () => {
  logger.info(`server listening on :${config.PORT}`)
})
