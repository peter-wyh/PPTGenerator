import type { Role } from '@ppt-generator/shared'

// 覆盖两种 Request 引用路径：直接 `import { Request } from 'express'`（控制器）
// 与经 RequestHandler 推断（中间件，其内部 Request 指向 express-serve-static-core）。
declare module 'express' {
  interface Request {
    user?: { id: string; username: string; role: Role }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; username: string; role: Role }
  }
}
