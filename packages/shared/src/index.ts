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
