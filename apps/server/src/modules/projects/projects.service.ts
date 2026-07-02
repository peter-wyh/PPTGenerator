import { randomUUID } from 'node:crypto';
import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Project, Prisma } from '@prisma/client';
import type { Page, ProjectDetail, ProjectSummary } from '@mediakit/shared';

/** 新建项目的默认 pages：单个空白页。 */
export function defaultPages(): Page[] {
  return [{ id: randomUUID(), name: '第 1 页', components: [] }];
}

function pageCount(pages: unknown): number {
  return Array.isArray(pages) ? pages.length : 0;
}

function toSummary(p: Project): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    width: p.width,
    height: p.height,
    pageCount: pageCount(p.pages),
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
    input: { name: string; width?: number; height?: number; pages?: Page[] },
  ): Promise<ProjectDetail> {
    const data: Prisma.ProjectCreateInput = {
      owner: { connect: { id: ownerId } },
      name: input.name,
      width: input.width ?? 1280,
      height: input.height ?? 720,
      pages: (input.pages ?? defaultPages()) as unknown as Prisma.InputJsonValue,
    };
    const project = await prisma.project.create({ data });
    return toDetail(project);
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
    input: { name?: string; width?: number; height?: number; pages?: Page[] },
  ): Promise<ProjectDetail> {
    await this.getOwnedOrThrow(ownerId, id);
    const data: Prisma.ProjectUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.width !== undefined) data.width = input.width;
    if (input.height !== undefined) data.height = input.height;
    if (input.pages !== undefined) data.pages = input.pages as unknown as Prisma.InputJsonValue;
    const project = await prisma.project.update({ where: { id }, data });
    return toDetail(project);
  },

  async remove(ownerId: string, id: string): Promise<void> {
    await this.getOwnedOrThrow(ownerId, id);
    await prisma.project.delete({ where: { id } });
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
};
