import { Redis } from 'ioredis'
import { config } from './config'

export const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null })

export const REFRESH_BLACKLIST_PREFIX = 'auth:refresh:'
export const refreshKey = (jti: string) => `${REFRESH_BLACKLIST_PREFIX}${jti}`
