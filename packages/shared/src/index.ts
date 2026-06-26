export type Role = 'ADMIN' | 'USER'

export interface UserPublic {
  id: string
  username: string
  role: Role
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
}

export interface CreateUserRequest {
  username: string
  password: string
  role?: Role
}

export interface UpdateUserRequest {
  password?: string
  role?: Role
}

export interface CreateProjectRequest {
  name: string
}

export interface UpdateProjectRequest {
  name?: string
  canvasWidth?: number
  canvasHeight?: number
  pages?: unknown // P1 编辑器会给出强类型 Page[]；P0 透传
}

export interface ProjectSummary {
  id: string
  name: string
  userId: string
  updatedAt: string
}
