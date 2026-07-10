/**
 * 项目类型。前后端共享。
 */
import type { ProjectMeta } from './theme';
import type { Page } from './page';

export interface ProjectSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  /** 页数，便于列表展示（不展开 pages）。 */
  pageCount: number;
  /** 项目元数据（业务线/创建人/场景/广告主/campaign 信息）。 */
  meta?: ProjectMeta;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  pages: Page[];
  width: number;
  height: number;
  meta?: ProjectMeta;
  createdAt: string;
  updatedAt: string;
}
