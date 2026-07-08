import { randomUUID } from 'node:crypto';
import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Template, TemplateStatus, Prisma } from '@prisma/client';
import type {
  Page,
  ProjectMeta,
  TemplateDetail,
  TemplateSummary,
} from '@mediakit/shared';

/** 新建模版的默认 pages：单个空白页（与项目默认一致）。 */
export function defaultTemplatePages(): Page[] {
  return [{ id: randomUUID(), name: '第 1 页', components: [] }];
}

function pageCount(pages: unknown): number {
  return Array.isArray(pages) ? pages.length : 0;
}

function metaOf(t: Template): ProjectMeta | undefined {
  return (t.meta as unknown as ProjectMeta | null) ?? undefined;
}

/** 列表摘要（不带 pages，节省带宽）。 */
export function toSummary(t: Template): TemplateSummary {
  return {
    id: t.id,
    name: t.name,
    width: t.width,
    height: t.height,
    pageCount: pageCount(t.pages),
    meta: metaOf(t),
    status: t.status,
    note: t.note,
    ownerId: t.ownerId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** 详情（含 pages，供编辑器加载）。 */
export function toDetail(t: Template): TemplateDetail {
  return {
    id: t.id,
    name: t.name,
    pages: (t.pages as unknown as Page[]) ?? [],
    width: t.width,
    height: t.height,
    meta: metaOf(t),
    status: t.status,
    note: t.note,
    ownerId: t.ownerId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export const templatesService = {
  /**
   * 列表：ADMIN 看全部（含草稿），普通用户只看已发布。
   * 支持按 status / businessLine / scenario 过滤。
   */
  async list(
    requesterRole: 'ADMIN' | 'USER',
    filters?: { status?: TemplateStatus; businessLine?: string; scenario?: string },
  ) {
    const where: Prisma.TemplateWhereInput = {};
    // 非 ADMIN 只能看已发布。
    if (requesterRole !== 'ADMIN') {
      where.status = 'PUBLISHED';
    } else if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.businessLine)
      where.meta = { path: '$.businessLine', string_contains: filters.businessLine };
    if (filters?.scenario) where.meta = { path: '$.scenario', string_contains: filters.scenario };

    const templates = await prisma.template.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    return templates.map(toSummary);
  },

  /** ADMIN 取得自己的模版（原始 Prisma 对象），否则 404。 */
  async getOwnedOrThrow(ownerId: string, id: string): Promise<Template> {
    const template = await prisma.template.findUnique({ where: { id } });
    if (!template || template.ownerId !== ownerId) {
      throw ApiError.notFound('Template not found');
    }
    return template;
  },

  /** ADMIN 取得自己的模版详情（序列化），否则 404。 */
  async getOwnedDetailOrThrow(ownerId: string, id: string): Promise<TemplateDetail> {
    return toDetail(await this.getOwnedOrThrow(ownerId, id));
  },

  /** ADMIN 创建模版。 */
  async create(
    ownerId: string,
    input: {
      name: string;
      width?: number;
      height?: number;
      pages?: Page[];
      meta?: ProjectMeta;
      note?: string;
    },
  ): Promise<TemplateDetail> {
    const data: Prisma.TemplateCreateInput = {
      owner: { connect: { id: ownerId } },
      name: input.name,
      width: input.width ?? 1280,
      height: input.height ?? 720,
      pages: (input.pages ?? defaultTemplatePages()) as unknown as Prisma.InputJsonValue,
      ...(input.meta ? { meta: input.meta as unknown as Prisma.InputJsonValue } : {}),
      ...(input.note ? { note: input.note } : {}),
      status: 'DRAFT',
    };
    const template = await prisma.template.create({ data });
    return toDetail(template);
  },

  /** ADMIN 更新模版（含编辑器 autosave 走此路径）。 */
  async update(
    ownerId: string,
    id: string,
    input: {
      name?: string;
      width?: number;
      height?: number;
      pages?: Page[];
      meta?: ProjectMeta;
      note?: string | null;
      status?: TemplateStatus;
    },
  ): Promise<TemplateDetail> {
    await this.getOwnedOrThrow(ownerId, id);
    const data: Prisma.TemplateUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.width !== undefined) data.width = input.width;
    if (input.height !== undefined) data.height = input.height;
    if (input.pages !== undefined) data.pages = input.pages as unknown as Prisma.InputJsonValue;
    if (input.meta !== undefined) data.meta = input.meta as unknown as Prisma.InputJsonValue;
    if (input.note !== undefined) data.note = input.note;
    if (input.status !== undefined) data.status = input.status;
    const template = await prisma.template.update({ where: { id }, data });
    return toDetail(template);
  },

  async remove(ownerId: string, id: string): Promise<void> {
    await this.getOwnedOrThrow(ownerId, id);
    await prisma.template.delete({ where: { id } });
  },

  async duplicate(ownerId: string, id: string): Promise<TemplateDetail> {
    const src = await this.getOwnedOrThrow(ownerId, id);
    const data: Prisma.TemplateCreateInput = {
      owner: { connect: { id: ownerId } },
      name: `${src.name} 副本`,
      width: src.width,
      height: src.height,
      pages: JSON.parse(JSON.stringify(src.pages)) as unknown as Prisma.InputJsonValue,
      ...(src.meta ? { meta: src.meta as unknown as Prisma.InputJsonValue } : {}),
      status: 'DRAFT',
    };
    const template = await prisma.template.create({ data });
    return toDetail(template);
  },

  /** 已发布模版：任意已登录用户可读（用于"从模版创建项目"）。 */
  async getPublishedOrThrow(id: string): Promise<TemplateDetail> {
    const template = await prisma.template.findUnique({ where: { id } });
    if (!template || template.status !== 'PUBLISHED') {
      throw ApiError.notFound('Template not found or not published');
    }
    return toDetail(template);
  },
};
