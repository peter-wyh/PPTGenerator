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
  canvasWidth: number
  canvasHeight: number
  userId: string
  updatedAt: string
}

export interface ProjectPage {
  id: string
  name: string
  components: unknown[]
}

export interface ProjectDetail {
  id: string
  userId: string
  name: string
  canvasWidth: number
  canvasHeight: number
  pages: ProjectPage[]
  createdAt: string
  updatedAt: string
}

export type ResizeDir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

export interface TextData {
  content: string
  fontSize: number
  fontWeight?: number
  color?: string
  bgColor?: string
}

export interface ImageData {
  src: string
}

export interface EditorComponent {
  id: string
  type: 'text' | 'image'
  x: number
  y: number
  w: number
  h: number
  data: TextData | ImageData
}

export interface EditorPage {
  id: string
  name: string
  components: EditorComponent[]
}
