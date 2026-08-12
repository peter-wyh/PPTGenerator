import { randomUUID } from 'node:crypto';
import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Template, TemplateStatus, Prisma } from '@prisma/client';
import { builtinDefaultPages } from '@mediakit/shared';
import type {
  Page,
  ProjectMeta,
  TemplateDetail,
  TemplateMeta,
  TemplateSummary,
} from '@mediakit/shared';

/**
 * 新建模版的默认 pages：真实页面树（封面 + 概览页），不再是单空白页。
 * 使用 shared 包的 builtinDefaultPages，前后端共用同一份页面数据；
 * 服务端注入 node:crypto.randomUUID 作为 ID 生成器。
 */
export function defaultTemplatePages(): Page[] {
  return builtinDefaultPages(() => randomUUID());
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
    hasHtml: !!t.htmlContent,
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
    htmlContent: t.htmlContent ?? undefined,
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
    // Reject duplicate template names (case-insensitive, trimmed).
    const trimmedName = input.name.trim();
    if (!trimmedName) throw ApiError.badRequest('模版名称不能为空');
    const existing = await prisma.template.findFirst({
      where: { name: trimmedName },
      select: { id: true },
    });
    if (existing) throw ApiError.badRequest(`已存在同名模版「${trimmedName}」，请使用其他名称`);

    const data: Prisma.TemplateCreateInput = {
      owner: { connect: { id: ownerId } },
      name: trimmedName,
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
      htmlContent?: string;
    },
  ): Promise<TemplateDetail> {
    await this.getOwnedOrThrow(ownerId, id);

    // If renaming, reject duplicate names (case-insensitive, trimmed).
    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (!trimmedName) throw ApiError.badRequest('模版名称不能为空');
      const clash = await prisma.template.findFirst({
        where: {
          name: trimmedName,
          id: { not: id },
        },
        select: { id: true },
      });
      if (clash) throw ApiError.badRequest(`已存在同名模版「${trimmedName}」，请使用其他名称`);
    }

    const data: Prisma.TemplateUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.width !== undefined) data.width = input.width;
    if (input.height !== undefined) data.height = input.height;
    if (input.pages !== undefined) data.pages = input.pages as unknown as Prisma.InputJsonValue;
    if (input.meta !== undefined) data.meta = input.meta as unknown as Prisma.InputJsonValue;
    if (input.note !== undefined) data.note = input.note;
    if (input.status !== undefined) data.status = input.status;
    if (input.htmlContent !== undefined) data.htmlContent = input.htmlContent;
    const template = await prisma.template.update({ where: { id }, data });
    return toDetail(template);
  },

  async remove(ownerId: string, id: string): Promise<void> {
    await this.getOwnedOrThrow(ownerId, id);
    await prisma.template.delete({ where: { id } });
  },

  async duplicate(ownerId: string, id: string): Promise<TemplateDetail> {
    const src = await this.getOwnedOrThrow(ownerId, id);
    // Generate a unique copy name: "X 副本", "X 副本 2", ...
    const baseName = `${src.name} 副本`;
    let copyName = baseName;
    let suffix = 2;
    for (;;) {
      const clash = await prisma.template.findFirst({
        where: { name: copyName },
        select: { id: true },
      });
      if (!clash) break;
      copyName = `${baseName} ${suffix++}`;
    }
    const data: Prisma.TemplateCreateInput = {
      owner: { connect: { id: ownerId } },
      name: copyName,
      width: src.width,
      height: src.height,
      pages: JSON.parse(JSON.stringify(src.pages)) as unknown as Prisma.InputJsonValue,
      ...(src.meta ? { meta: src.meta as unknown as Prisma.InputJsonValue } : {}),
      ...(src.htmlContent ? { htmlContent: src.htmlContent } : {}),
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
   * 同名模板冲突时：overwrite=true → 覆盖已有模板的 pages/meta；overwrite=false → 抛 conflict。
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
      overwrite?: boolean;
    },
  ): Promise<TemplateDetail> {
    // 同名冲突检查
    const existing = await prisma.template.findFirst({
      where: { ownerId, name: input.name },
    });
    if (existing && !input.overwrite) {
      throw ApiError.conflict(
        `已存在同名模板「${input.name}」，是否覆盖？`,
        { existingId: existing.id },
      );
    }

    // 取项目数据
    const project = await prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw ApiError.notFound('Project not found');

    const projectPages = (project.pages as unknown as Page[]) ?? [];
    const srcPage = projectPages.find((p) => p.id === input.pageId);
    if (!srcPage) throw ApiError.notFound('Page not found in project');

    // 复制源页为模板页：展开保留全部字段（背景 bgColor/bgGradient/bgImage、
    // titleOverridden、titleComponentId 等），仅清除运行时数据绑定（campaignId/creatorId）
    // 并换新 id。此前用「字段白名单」拷贝会漏掉背景与 titleOverridden → 保存为模板后丢失。
    const tplPage: Page = { ...srcPage };
    delete tplPage.campaignId;
    delete tplPage.creatorId;
    tplPage.id = randomUUID();
    tplPage.components = (srcPage.components ?? []).map((c) => {
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
    });

    const pagesJson = [tplPage] as unknown as Prisma.InputJsonValue;
    const metaJson = input.meta
      ? (input.meta as unknown as Prisma.InputJsonValue)
      : undefined;

    // 覆盖模式：更新已有模板
    if (existing && input.overwrite) {
      const updated = await prisma.template.update({
        where: { id: existing.id },
        data: {
          pages: pagesJson,
          width: input.width ?? project.width,
          height: input.height ?? project.height,
          ...(metaJson ? { meta: metaJson } : {}),
          ...(input.note ? { note: input.note } : {}),
        },
      });
      return toDetail(updated);
    }

    // 新建模式
    const data: Prisma.TemplateCreateInput = {
      owner: { connect: { id: ownerId } },
      name: input.name,
      width: input.width ?? project.width,
      height: input.height ?? project.height,
      pages: pagesJson,
      ...(metaJson ? { meta: metaJson } : {}),
      ...(input.note ? { note: input.note } : {}),
      status: 'DRAFT',
    };
    const template = await prisma.template.create({ data });
    return toDetail(template);
  },

  /**
   * 从整个项目创建模板（ADMIN）。
   * 将项目的所有页面复制为模板页面，清除运行时数据绑定（campaignId/creatorId）。
   * 同名模板冲突时：overwrite=true → 覆盖已有模板的 pages/meta；overwrite=false → 抛 conflict。
   */
  async createFromProject(
    ownerId: string,
    input: {
      projectId: string;
      name: string;
      meta?: ProjectMeta;
      note?: string;
      overwrite?: boolean;
    },
  ): Promise<TemplateDetail> {
    // 同名冲突检查
    const existing = await prisma.template.findFirst({
      where: { ownerId, name: input.name },
    });
    if (existing && !input.overwrite) {
      throw ApiError.conflict(
        `已存在同名模板「${input.name}」，是否覆盖？`,
        { existingId: existing.id },
      );
    }

    // 取项目数据
    const project = await prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw ApiError.notFound('Project not found');

    const projectPages = (project.pages as unknown as Page[]) ?? [];

    // 复制每一页为模板页：清除数据绑定 + 换新 id
    const tplPages: Page[] = projectPages.map((srcPage) => {
      const tplPage: Page = { ...srcPage };
      delete tplPage.campaignId;
      delete tplPage.creatorId;
      tplPage.id = randomUUID();
      tplPage.components = (srcPage.components ?? []).map((c) => {
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
      });
      return tplPage;
    });

    const pagesJson = tplPages as unknown as Prisma.InputJsonValue;
    const metaJson = input.meta
      ? (input.meta as unknown as Prisma.InputJsonValue)
      : undefined;

    // 覆盖模式：更新已有模板
    if (existing && input.overwrite) {
      const updated = await prisma.template.update({
        where: { id: existing.id },
        data: {
          pages: pagesJson,
          width: project.width,
          height: project.height,
          ...(metaJson ? { meta: metaJson } : {}),
          ...(input.note ? { note: input.note } : {}),
        },
      });
      return toDetail(updated);
    }

    // 新建模式
    const data: Prisma.TemplateCreateInput = {
      owner: { connect: { id: ownerId } },
      name: input.name,
      width: project.width,
      height: project.height,
      pages: pagesJson,
      ...(metaJson ? { meta: metaJson } : {}),
      ...(input.note ? { note: input.note } : {}),
      ...(project.htmlContent ? { htmlContent: project.htmlContent } : {}),
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
