import type { Role } from '@ppt-generator/shared'

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; username: string; role: Role }
  }
}
