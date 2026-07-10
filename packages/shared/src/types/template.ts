/**
 * 模板类型。
 * 模板由设计师（ADMIN）在管理后台维护，BD（USER）从已发布模板创建项目。
 */
import type { ProjectMeta } from './theme';
import type { Page } from './page';

export type TemplateStatus = 'DRAFT' | 'PUBLISHED';

export interface TemplateSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  pageCount: number;
  meta?: ProjectMeta;
  status: TemplateStatus;
  /** 设计师备注（仅管理后台可见）。 */
  note?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateDetail {
  id: string;
  name: string;
  pages: Page[];
  width: number;
  height: number;
  meta?: ProjectMeta;
  status: TemplateStatus;
  note?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
