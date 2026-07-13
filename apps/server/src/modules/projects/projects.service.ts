import { randomUUID } from 'node:crypto';
import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Project, Prisma } from '@prisma/client';
import type { Page, ProjectDetail, ProjectMeta, ProjectSummary } from '@mediakit/shared';

/** 新建项目的默认 pages：单个空白页。 */
export function defaultPages(): Page[] {
  return [{ id: randomUUID(), name: '第 1 页', components: [] }];
}

function pageCount(pages: unknown): number {
  return Array.isArray(pages) ? pages.length : 0;
}

function metaOf(p: Project): ProjectMeta | undefined {
  return (p.meta as unknown as ProjectMeta | null) ?? undefined;
}

function toSummary(p: Project): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    width: p.width,
    height: p.height,
    pageCount: pageCount(p.pages),
    meta: metaOf(p),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toDetail(p: Project): ProjectDetail {
  return {
    id: p.id,
    name: p.name,
    pages: (p.pages as unknown as Page[]) ?? [],
    width: p.width,
    height: p.height,
    meta: metaOf(p),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const projectsService = {
  async list(ownerId: string): Promise<ProjectSummary[]> {
    const projects = await prisma.project.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });
    return projects.map(toSummary);
  },

  async create(
    ownerId: string,
    input: {
      name: string;
      width?: number;
      height?: number;
      pages?: Page[];
      meta?: ProjectMeta;
    },
  ): Promise<{ detail: ProjectDetail; seeded: boolean }> {
    const meta = input.meta;
    const seedKey =
      meta && meta.businessLine && meta.scenario && meta.templateType
        ? {
            businessLine: meta.businessLine,
            scenario: meta.scenario,
            templateType: meta.templateType,
          }
        : null;

    let pages = input.pages;
    let width = input.width;
    let height = input.height;
    let theme = meta?.theme;
    let seeded = false;

    // 仅当调用方未自带 pages 且三字段齐全时,尝试套用默认模板骨架。
    if (seedKey && !input.pages) {
      const tpl = await prisma.template.findFirst({
        where: {
          status: 'PUBLISHED',
          AND: [
            { meta: { path: '$.businessLine', equals: seedKey.businessLine } },
            { meta: { path: '$.scenario', equals: seedKey.scenario } },
            { meta: { path: '$.templateType', equals: seedKey.templateType } },
            { meta: { path: '$.isDefault', equals: true } },
          ],
        },
      });
      if (tpl) {
        pages = JSON.parse(JSON.stringify(tpl.pages)) as Page[];
        width = tpl.width;
        height = tpl.height;
        const tplMeta = (tpl.meta as unknown as ProjectMeta | null) ?? {};
        theme = tplMeta.theme ?? theme;
        seeded = true;
      }
    }

    const finalMeta: ProjectMeta | undefined = meta
      ? { ...meta, ...(theme !== undefined ? { theme } : {}) }
      : undefined;

    const data: Prisma.ProjectCreateInput = {
      owner: { connect: { id: ownerId } },
      name: input.name,
      width: width ?? 1280,
      height: height ?? 720,
      pages: (pages ?? defaultPages()) as unknown as Prisma.InputJsonValue,
      ...(finalMeta ? { meta: finalMeta as unknown as Prisma.InputJsonValue } : {}),
    };
    const project = await prisma.project.create({ data });
    return { detail: toDetail(project), seeded };
  },

  /** 取得 owner 自己的项目，否则 404（不泄露存在性）。 */
  async getOwnedOrThrow(ownerId: string, id: string): Promise<ProjectDetail> {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.ownerId !== ownerId) {
      throw ApiError.notFound('Project not found');
    }
    return toDetail(project);
  },

  async update(
    ownerId: string,
    id: string,
    input: {
      name?: string;
      width?: number;
      height?: number;
      pages?: Page[];
      meta?: ProjectMeta;
    },
  ): Promise<ProjectDetail> {
    await this.getOwnedOrThrow(ownerId, id);
    const data: Prisma.ProjectUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.width !== undefined) data.width = input.width;
    if (input.height !== undefined) data.height = input.height;
    if (input.pages !== undefined) data.pages = input.pages as unknown as Prisma.InputJsonValue;
    if (input.meta !== undefined) data.meta = input.meta as unknown as Prisma.InputJsonValue;
    const project = await prisma.project.update({ where: { id }, data });
    return toDetail(project);
  },

  async remove(ownerId: string, id: string): Promise<void> {
    await this.getOwnedOrThrow(ownerId, id);
    await prisma.project.delete({ where: { id } });
  },

  /** 从模版创建项目：深拷贝模版 pages/meta/尺寸，归属当前用户。 */
  async createFromTemplate(
    ownerId: string,
    templateId: string,
    name?: string,
  ): Promise<ProjectDetail> {
    const tpl = await prisma.template.findUnique({ where: { id: templateId } });
    if (!tpl || tpl.status !== 'PUBLISHED') {
      throw ApiError.notFound('Template not found or not published');
    }
    const data: Prisma.ProjectCreateInput = {
      owner: { connect: { id: ownerId } },
      name: name?.trim() || `${tpl.name}`,
      width: tpl.width,
      height: tpl.height,
      pages: JSON.parse(JSON.stringify(tpl.pages)) as unknown as Prisma.InputJsonValue,
      ...(tpl.meta ? { meta: tpl.meta as unknown as Prisma.InputJsonValue } : {}),
    };
    const project = await prisma.project.create({ data });
    return toDetail(project);
  },

  async duplicate(ownerId: string, id: string): Promise<ProjectDetail> {
    const src = await this.getOwnedOrThrow(ownerId, id);
    const data: Prisma.ProjectCreateInput = {
      owner: { connect: { id: ownerId } },
      name: `${src.name} 副本`,
      width: src.width,
      height: src.height,
      // 深拷贝并给每个页面/组件分配新 id，避免引用同一对象。
      pages: JSON.parse(JSON.stringify(src.pages)) as unknown as Prisma.InputJsonValue,
    };
    const project = await prisma.project.create({ data });
    return toDetail(project);
  },

  /** Owner 生成（或刷新）公开分享 token。 */
  async createShareToken(ownerId: string, id: string): Promise<string> {
    await this.getOwnedOrThrow(ownerId, id);
    const token = randomUUID();
    await prisma.project.update({ where: { id }, data: { shareToken: token } });
    return token;
  },

  /** Owner 撤销分享 token。 */
  async revokeShareToken(ownerId: string, id: string): Promise<void> {
    await this.getOwnedOrThrow(ownerId, id);
    await prisma.project.update({ where: { id }, data: { shareToken: null } });
  },

  /** 按 share token 公开读取（无认证）。token 不存在或为 null → 404（不泄露存在性）。 */
  async getByShareToken(token: string): Promise<ProjectDetail> {
    const project = await prisma.project.findUnique({ where: { shareToken: token } });
    if (!project) {
      throw ApiError.notFound('Shared project not found');
    }
    return toDetail(project);
  },

  /** Owner 取得当前 share token（若有），不抛错。供导出复用。 */
  async getShareToken(ownerId: string, id: string): Promise<string | null> {
    await this.getOwnedOrThrow(ownerId, id);
    const raw = await prisma.project.findUnique({ where: { id }, select: { shareToken: true } });
    return raw?.shareToken ?? null;
  },
};
