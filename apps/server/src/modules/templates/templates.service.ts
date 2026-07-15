import { randomUUID } from 'node:crypto';
import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Template, TemplateStatus, Prisma } from '@prisma/client';
import type {
  Page,
  ProjectMeta,
  TemplateDetail,
  TemplateMeta,
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

/** (businessLine×scenario×templateType) 格的默认模板匹配谓词(4 个 JSON equals 子句)。 */
function cellWhereAnd(cell: {
  businessLine: string;
  scenario: string;
  templateType: string;
}): Prisma.TemplateWhereInput[] {
  return [
    { meta: { path: '$.businessLine', equals: cell.businessLine } },
    { meta: { path: '$.scenario', equals: cell.scenario } },
    { meta: { path: '$.templateType', equals: cell.templateType } },
    { meta: { path: '$.isDefault', equals: true } },
  ];
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
   * 列表:ADMIN 看全部(含草稿),普通用户只看已发布。
   * 支持按 status / businessLine / scenario / templateType / isDefault 过滤。
   */
  async list(
    requesterRole: 'ADMIN' | 'USER',
    filters?: {
      status?: TemplateStatus;
      businessLine?: string;
      scenario?: string;
      templateType?: string;
      isDefault?: boolean;
    },
  ) {
    const where: Prisma.TemplateWhereInput = {};
    if (requesterRole !== 'ADMIN') {
      where.status = 'PUBLISHED';
    } else if (filters?.status) {
      where.status = filters.status;
    }
    const metaAnd: Prisma.TemplateWhereInput[] = [];
    if (filters?.businessLine)
      metaAnd.push({ meta: { path: '$.businessLine', equals: filters.businessLine } });
    if (filters?.scenario)
      metaAnd.push({ meta: { path: '$.scenario', equals: filters.scenario } });
    if (filters?.templateType)
      metaAnd.push({ meta: { path: '$.templateType', equals: filters.templateType } });
    if (filters?.isDefault !== undefined)
      metaAnd.push({ meta: { path: '$.isDefault', equals: filters.isDefault } });
    if (metaAnd.length) where.AND = metaAnd;

    const templates = await prisma.template.findMany({ where, orderBy: { updatedAt: 'desc' } });
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

  /**
   * 设/取消某模板为 (businessLine×scenario×templateType) 格的默认模板。
   * 设默认(value=true):要求 PUBLISHED + 三字段齐全;事务内先清同格其它默认,再置本模板。
   * 取消默认(value=false):仅置本模板 isDefault=false。
   *
   * 并发注意:无 DB 级 cell 唯一约束,两个并发 setDefault(true) 同格可能短暂并存两个默认。
   * Phase 1 接受该风险(仅 ADMIN、低写并发);如需强一致可后续加 SELECT...FOR UPDATE 或 cell 唯一索引。
   */
  async setDefault(ownerId: string, id: string, value: boolean): Promise<TemplateDetail> {
    const tpl = await this.getOwnedOrThrow(ownerId, id);
    const m = (tpl.meta as unknown as TemplateMeta | null) ?? {};
    if (value) {
      if (tpl.status !== 'PUBLISHED') {
        throw ApiError.badRequest('发布后才能设为默认模板');
      }
      const { businessLine, scenario, templateType } = m;
      if (!businessLine || !scenario || !templateType) {
        throw ApiError.badRequest('请先选择业务线 / 场景 / 模版类型');
      }
      await prisma.$transaction(async (tx) => {
        const others = await tx.template.findMany({
          where: {
            id: { not: id },
            status: 'PUBLISHED',
            AND: cellWhereAnd({ businessLine, scenario, templateType }),
          },
          select: { id: true, meta: true },
        });
        for (const o of others) {
          const om = (o.meta as Record<string, unknown> | null) ?? {};
          await tx.template.update({
            where: { id: o.id },
            data: { meta: { ...om, isDefault: false } as unknown as Prisma.InputJsonValue },
          });
        }
        await tx.template.update({
          where: { id },
          data: { meta: { ...m, isDefault: true } as unknown as Prisma.InputJsonValue },
        });
      });
    } else {
      await prisma.template.update({
        where: { id },
        data: { meta: { ...m, isDefault: false } as unknown as Prisma.InputJsonValue },
      });
    }
    return toDetail(await this.getOwnedOrThrow(ownerId, id));
  },

  /**
   * 从项目的某个页面创建模板（ADMIN）。
   * 取出项目的指定页，将其组件剥离数据绑定（保留样式/布局/类型），包装为单页模板。
   */
  async createFromProjectPage(
    ownerId: string,
    input: {
      projectId: string;
      pageId: string;
      name: string;
      width?: number;
      height?: number;
      meta?: ProjectMeta;
      note?: string;
    },
  ): Promise<TemplateDetail> {
    // 取项目数据
    const project = await prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw ApiError.notFound('Project not found');

    const projectPages = (project.pages as unknown as Page[]) ?? [];
    const srcPage = projectPages.find((p) => p.id === input.pageId);
    if (!srcPage) throw ApiError.notFound('Page not found in project');

    // 复制页面作为模板页（保留组件布局/样式，清除运行时绑定标记）
    const tplPage: Page = {
      id: randomUUID(),
      name: srcPage.name,
      pageType: srcPage.pageType,
      titleComponentId: srcPage.titleComponentId,
      components: (srcPage.components ?? []).map((c) => {
        // 浅拷贝组件，清除数据绑定字段（creatorId/campaignId 等）
        const clone = { ...c } as Record<string, unknown>;
        delete clone.creatorId;
        delete clone.campaignId;
        if (clone.data && typeof clone.data === 'object') {
          const data = { ...(clone.data as Record<string, unknown>) };
          delete data.creatorId;
          delete data.campaignId;
          clone.data = data;
        }
        return clone as unknown as Page['components'][number];
      }),
    };

    const data: Prisma.TemplateCreateInput = {
      owner: { connect: { id: ownerId } },
      name: input.name,
      width: input.width ?? project.width,
      height: input.height ?? project.height,
      pages: [tplPage] as unknown as Prisma.InputJsonValue,
      ...(input.meta ? { meta: input.meta as unknown as Prisma.InputJsonValue } : {}),
      ...(input.note ? { note: input.note } : {}),
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

  /**
   * 套骨架用:按 (businessLine×scenario×templateType) 格查唯一默认已发布模板。
   * 并发下同格可能短暂存在多个默认(setDefault 的已知限制),findFirst 取其一即可。
   */
  async findDefaultForCell(
    businessLine: string,
    scenario: string,
    templateType: string,
  ): Promise<Template | null> {
    return prisma.template.findFirst({
      where: { status: 'PUBLISHED', AND: cellWhereAnd({ businessLine, scenario, templateType }) },
    });
  },
};
