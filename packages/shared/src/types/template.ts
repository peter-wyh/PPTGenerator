/**
 * 模板类型。
 * 模板由设计师（ADMIN）在管理后台维护，BD（USER）从已发布模板创建项目。
 */
import type { ProjectMeta } from './theme';
import type { Page } from './page';

export type TemplateStatus = 'DRAFT' | 'PUBLISHED';

/**
 * 模板元数据：在 ProjectMeta 基础上增加 isDefault（仅模板有意义）。
 * isDefault 标记该模板为 (businessLine×scenario×templateType) 格的默认模板，
 * 新建项目时按此格自动套用骨架。Project 不使用该字段。
 */
export type TemplateMeta = ProjectMeta & { isDefault?: boolean };

export interface TemplateSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  pageCount: number;
  meta?: TemplateMeta;
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
  meta?: TemplateMeta;
  status: TemplateStatus;
  note?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
