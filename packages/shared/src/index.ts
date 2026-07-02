/**
 * MediaKit 共享类型（type-only）。前后端共享。
 * 对齐 docs/superpowers/specs/2026-06-30-mediakit-fresh-rewrite-design.md §3.3。
 */

/* ------------------------------------------------------------------ */
/* 认证 / 用户                                                         */
/* ------------------------------------------------------------------ */

export type Role = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

/** 登录响应：access token 放响应体（前端存内存），refresh 走 httpOnly cookie。 */
export interface LoginResponse {
  user: User;
  accessToken: string;
  /** access token 剩余有效期（秒），供前端调度刷新。 */
  expiresIn: number;
}

export interface AuthSession {
  user: User;
  accessToken: string;
}

/* ------------------------------------------------------------------ */
/* 项目                                                                */
/* ------------------------------------------------------------------ */

export interface ProjectSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  /** 页数，便于列表展示（不展开 pages）。 */
  pageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  pages: Page[];
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* 编辑器数据模型（M0 仅定义类型，编辑器内核在 M1 落地）                */
/* ------------------------------------------------------------------ */

export type ComponentType =
  | 'text'
  | 'image'
  | 'indicator-card'
  | 'bar-chart'
  | 'line-chart'
  | 'pie-chart'
  | 'table'
  | 'business-block';

/* ---- 各组件 Data（取自 demo.html + G2/G4 spec） ---- */

export interface TextData {
  content: string;
  fontSize: number;
  fontWeight?: number;
  fontFamily?: string;
  color: string;
  bgColor?: string;
  padding?: number;
}

export interface ImageData {
  src: string;
  fit: 'cover' | 'contain' | 'fill';
}

export interface IndicatorCardData {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  colorTheme: 'orange' | 'green' | 'blue' | 'purple' | 'red';
}

export interface BarChartDatum {
  label: string;
  value: number;
  color: string;
}
export interface BarChartData {
  title?: string;
  bars: BarChartDatum[];
}

export interface LineChartDatum {
  label: string;
  value: number;
}
export interface LineChartSeries {
  name: string;
  color: string;
  points: LineChartDatum[];
}
export interface LineChartData {
  title?: string;
  series: LineChartSeries[];
}

export interface PieChartSlice {
  label: string;
  value: number;
  color: string;
}
export interface PieChartData {
  title?: string;
  slices: PieChartSlice[];
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export type BusinessVariant =
  | 'standard'
  | 'cards'
  | 'accent'
  | 'stats'
  | 'light'
  | 'table'
  | 'results';

export interface BusinessBlockData {
  businessKind: string;
  title: string;
  meta: string;
  details: string[];
  variant: BusinessVariant;
  layoutForm?: string;
}

export type ComponentData =
  | TextData
  | ImageData
  | IndicatorCardData
  | BarChartData
  | LineChartData
  | PieChartData
  | TableData
  | BusinessBlockData;

export interface EditorComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  w: number;
  h: number;
  data: ComponentData;
  locked?: boolean;
  z?: number;
  /** 数据源绑定（M5）：绑定后组件按列从数据源渲染。 */
  binding?: ComponentBinding;
}

/** 数据源绑定：选数据源 + 取值/标签列。 */
export interface ComponentBinding {
  datasourceId: string;
  labelColumn?: string;
  valueColumn?: string;
}

/** 数据源：上传的 CSV/Excel 解析为表格。 */
export interface Datasource {
  id: string;
  name: string;
  columns: string[];
  rows: Record<string, string>[];
}

export interface Page {
  id: string;
  name: string;
  components: EditorComponent[];
}
