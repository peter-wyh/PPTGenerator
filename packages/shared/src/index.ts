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

export type BasicComponentType =
  | 'text'
  | 'image'
  | 'indicator-card'
  | 'bar-chart'
  | 'line-chart'
  | 'pie-chart'
  | 'table'

export interface IndicatorCardData {
  title: string
  value: string
  trend: string
  trendUp: boolean
  colorTheme: 'blue' | 'green' | 'orange' | 'purple'
}

export interface BarChartDatum {
  label: string
  value: number
  color: string
}
export interface BarChartData {
  title: string
  bars: BarChartDatum[]
}

export interface LineChartPoint {
  label: string
  value: number
}
export interface LineChartData {
  title: string
  points: LineChartPoint[]
}

export interface PieChartSlice {
  label: string
  value: number
  color: string
}
export interface PieChartData {
  title: string
  slices: PieChartSlice[]
}

export interface TableData {
  headers: string[]
  rows: string[][]
}

export interface EditorComponent {
  id: string
  type: BasicComponentType
  x: number
  y: number
  w: number
  h: number
  data:
    | TextData
    | ImageData
    | IndicatorCardData
    | BarChartData
    | LineChartData
    | PieChartData
    | TableData
}

export interface EditorPage {
  id: string
  name: string
  components: EditorComponent[]
}

export interface EmailDealItem {
  brand: string
  text: string
  img: string
  link: string
}

export interface EmailProductItem {
  brand: string
  name: string
  discount: string
  img: string
  link: string
}

export interface EmailFeatureDetail {
  img: string
  text: string
}

export interface EmailFeature {
  title: string
  intro: string
  mainImg: string
  prodName: string
  btnText: string
  btnLink: string
  details: EmailFeatureDetail[]
}

export interface EmailData {
  header: { logo: string; subtitle: string }
  hero: { title: string }
  topDeals: EmailDealItem[]
  date: string
  feature: EmailFeature
  fashion: EmailProductItem[]
  beauty: EmailProductItem[]
}
