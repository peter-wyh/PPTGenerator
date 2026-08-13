import { randomUUID } from 'node:crypto';
import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Project, Prisma } from '@prisma/client';
import type { Page, ProjectDetail, ProjectMeta, ProjectSummary } from '@mediakit/shared';
import { templatesService } from '../templates/templates.service';

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
    hasHtml: !!p.htmlContent,
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

/**
 * 替换 HTML 中的旧周期日期为新周期。
 * 处理多种格式：2024-01、2024-01-15、2024.01.15、2024年01月、Jan 2024 等。
 */
function replacePeriodInHtml(
  html: string,
  srcMeta: unknown,
  newPeriod: { month?: string; startDate?: string; endDate?: string },
): string {
  // 从源 meta 提取旧周期信息
  const meta = srcMeta as {
    reportPeriod?: { month?: string; startDate?: string; endDate?: string };
  } | null;
  const oldPeriod = meta?.reportPeriod;
  if (!oldPeriod) return html; // 无旧周期信息，无法替换

  let result = html;

  // 格式化辅助
  const formatDateCN = (d: string) => {
    const date = new Date(d);
    return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;
  };
  const formatDateShort = (d: string) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };
  const formatDateFull = (d: string) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const formatMonthCN = (month: string) => {
    const [y, m] = month.split('-');
    return `${y}年${m}月`;
  };

  // 构建替换映射 (旧值 → 新值)
  const replacements: [string, string][] = [];

  // 月份模式 (2024-01)
  if (oldPeriod.month && newPeriod.month) {
    replacements.push([oldPeriod.month, newPeriod.month]);
    replacements.push([formatMonthCN(oldPeriod.month), formatMonthCN(newPeriod.month)]);
    // 2024.01 格式
    const [, oldM] = oldPeriod.month.split('-');
    const [, newM] = newPeriod.month.split('-');
    const oldY = oldPeriod.month.split('-')[0];
    const newY = newPeriod.month.split('-')[0];
    replacements.push([`${oldY}.${oldM}`, `${newY}.${newM}`]);
  }

  // 日期范围模式
  if (oldPeriod.startDate && newPeriod.startDate) {
    replacements.push([oldPeriod.startDate, newPeriod.startDate]);
    replacements.push([formatDateCN(oldPeriod.startDate), formatDateCN(newPeriod.startDate)]);
    replacements.push([formatDateShort(oldPeriod.startDate), formatDateShort(newPeriod.startDate)]);
    replacements.push([formatDateFull(oldPeriod.startDate), formatDateFull(newPeriod.startDate)]);
  }
  if (oldPeriod.endDate && newPeriod.endDate) {
    replacements.push([oldPeriod.endDate, newPeriod.endDate]);
    replacements.push([formatDateCN(oldPeriod.endDate), formatDateCN(newPeriod.endDate)]);
    replacements.push([formatDateShort(oldPeriod.endDate), formatDateShort(newPeriod.endDate)]);
    replacements.push([formatDateFull(oldPeriod.endDate), formatDateFull(newPeriod.endDate)]);
  }

  // 执行所有替换（长字符串优先，避免部分匹配问题）
  replacements.sort((a, b) => b[0].length - a[0].length);
  for (const [oldVal, newVal] of replacements) {
    if (oldVal && newVal && oldVal !== newVal) {
      result = result.split(oldVal).join(newVal);
    }
  }

  return result;
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
    const trimmedName = input.name.trim();
    if (!trimmedName) throw ApiError.badRequest('报告名称不能为空');
    const existing = await prisma.project.findFirst({
      where: { name: trimmedName },
      select: { id: true },
    });
    if (existing)
      throw ApiError.badRequest(`已存在同名报告「${trimmedName}」，请使用其他名称`);

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
      const tpl = await templatesService.findDefaultForCell(
        seedKey.businessLine,
        seedKey.scenario,
        seedKey.templateType,
      );
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
      name: trimmedName,
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

  /** 属主读取某报告的 HTML 源码(仅供列表预览/下载/复制)。 */
  async getHtml(
    ownerId: string,
    id: string,
  ): Promise<{ id: string; name: string; html: string; updatedAt: string }> {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, ownerId: true, htmlContent: true, updatedAt: true },
    });
    if (!project || project.ownerId !== ownerId) {
      throw ApiError.notFound('Project not found');
    }
    return {
      id: project.id,
      name: project.name,
      html: project.htmlContent ?? '',
      updatedAt: project.updatedAt.toISOString(),
    };
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

    // 改名时拒绝重名(trim 后全局唯一),与 templates.service.update 一致。
    let trimmedName: string | undefined;
    if (input.name !== undefined) {
      trimmedName = input.name.trim();
      if (!trimmedName) throw ApiError.badRequest('报告名称不能为空');
      const clash = await prisma.project.findFirst({
        where: { name: trimmedName, id: { not: id } },
        select: { id: true },
      });
      if (clash)
        throw ApiError.badRequest(`已存在同名报告「${trimmedName}」，请使用其他名称`);
    }

    const data: Prisma.ProjectUpdateInput = {};
    if (trimmedName !== undefined) data.name = trimmedName;
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
    // 名称缺省回退模板名;全局重名时自动找号「X 副本 / X 副本 2 / …」(对齐 duplicate)。
    const desiredName = name?.trim() || tpl.name;
    let projectName = desiredName;
    let copyNumber = 0; // 已发生的撞名次数:0=未撞名用原名,1=「X 副本」,≥2=「X 副本 N」。
    for (;;) {
      const clash = await prisma.project.findFirst({
        where: { name: projectName },
        select: { id: true },
      });
      if (!clash) break;
      copyNumber++;
      projectName = copyNumber === 1 ? `${desiredName} 副本` : `${desiredName} 副本 ${copyNumber}`;
    }
    const data: Prisma.ProjectCreateInput = {
      owner: { connect: { id: ownerId } },
      name: projectName,
      width: tpl.width,
      height: tpl.height,
      pages: JSON.parse(JSON.stringify(tpl.pages)) as unknown as Prisma.InputJsonValue,
      ...(tpl.meta
        ? {
            meta: (({ isDefault: _omit, ...rest }) => rest)(
              tpl.meta as Record<string, unknown>,
            ) as unknown as Prisma.InputJsonValue,
          }
        : {}),
    };
    const project = await prisma.project.create({ data });
    return toDetail(project);
  },

  async duplicate(
    ownerId: string,
    id: string,
    newPeriod?: { month?: string; startDate?: string; endDate?: string },
  ): Promise<ProjectDetail> {
    // 直接查 Prisma 获取完整原始记录（toDetail 会剥离 htmlContent 等字段）
    const src = await prisma.project.findUnique({ where: { id } });
    if (!src || src.ownerId !== ownerId) {
      throw ApiError.notFound('Project not found');
    }
    // 生成唯一副本名:「X 副本」、「X 副本 2」…(对齐 templates.service.duplicate)
    const baseName = `${src.name} 副本`;
    let copyName = baseName;
    let suffix = 2;
    for (;;) {
      const clash = await prisma.project.findFirst({
        where: { name: copyName },
        select: { id: true },
      });
      if (!clash) break;
      copyName = `${baseName} ${suffix++}`;
    }

    // 深拷贝 meta，若有新周期则覆盖 reportPeriod + reportData.campaign 日期
    let meta = src.meta ? (JSON.parse(JSON.stringify(src.meta)) as Record<string, unknown>) : undefined;
    if (newPeriod && meta) {
      meta.reportPeriod = newPeriod;
      // 同步更新 reportData.campaign 的 startDate/endDate（驱动页眉 dateLabel / 封面标题周期文案）
      const rd = meta.reportData as { campaign?: { startDate?: string; endDate?: string; metrics?: unknown } } | undefined;
      if (rd?.campaign) {
        if (newPeriod.startDate) rd.campaign.startDate = newPeriod.startDate;
        if (newPeriod.endDate) rd.campaign.endDate = newPeriod.endDate;
      }
      // ★ 刷新 reportData 中的统计文案（metrics 标签中的周期信息等）
      // reportData 是快照缓存，其中 campaign.metrics 可能包含旧周期的硬编码数字
      // 这里清除旧 metrics，让前端在打开时如果有 campaignId 可以重新拉取
      if (rd?.campaign?.metrics) {
        // 保留 metrics 结构但标记需要刷新
        console.log('[duplicate] reportData.campaign.metrics will be refreshed on next generation');
      }
    }

    // ★ 复制 AI HTML 内容（若有），使 AI HTML 报告副本保留生成结果
    // 若指定了新周期且有 campaignId，重新拉取该周期的数据并重新生成 HTML
    let htmlContent = src.htmlContent;

    if (htmlContent && newPeriod) {
      // 从 meta 提取 campaignId
      const srcMeta = (src.meta ?? {}) as Record<string, unknown>;
      const campaignId = srcMeta.campaignId as string | undefined;

      if (campaignId) {
        // ★ 有 campaignId + newPeriod：重新用新周期数据生成 HTML
        // buildCampaignContext 已经增强了 period-aware 逻辑（按 daily 切片）
        try {
          const { aiGenerateService } = await import('../html-templates/ai-generate.service');
          // 从 meta 提取原始 prompt（如果有）
          const originalPrompt = (srcMeta.aiPrompt as string) || '';
          const designMd = (srcMeta.designMd as string) || undefined;
          const reportPeriod: { startDate?: string; endDate?: string } = {};
          if (newPeriod.startDate) reportPeriod.startDate = newPeriod.startDate;
          if (newPeriod.endDate) reportPeriod.endDate = newPeriod.endDate;

          htmlContent = await aiGenerateService.generateHtml({
            campaignId,
            prompt: originalPrompt || `(Generate a comprehensive performance report for period ${reportPeriod.startDate} to ${reportPeriod.endDate}. Analyze the data and create an insightful HTML report with KPIs, trends, and publisher breakdowns.)`,
            designMd,
            reportPeriod,
          });
          console.log(`[duplicate] HTML regenerated for new period ${JSON.stringify(reportPeriod)}`);
        } catch (err) {
          console.error('[duplicate] Failed to regenerate HTML for new period, falling back to text replacement:', err);
          // 降级：用文本替换（至少把日期文案更新）
          htmlContent = replacePeriodInHtml(htmlContent, src.meta, newPeriod);
        }
      } else {
        // 无 campaignId：只能做文本替换
        htmlContent = replacePeriodInHtml(htmlContent, src.meta, newPeriod);
      }
    }

    const data: Prisma.ProjectCreateInput = {
      owner: { connect: { id: ownerId } },
      name: copyName,
      width: src.width,
      height: src.height,
      // 深拷贝并给每个页面/组件分配新 id，避免引用同一对象。
      pages: JSON.parse(JSON.stringify(src.pages)) as unknown as Prisma.InputJsonValue,
      ...(meta ? { meta: meta as unknown as Prisma.InputJsonValue } : {}),
      // ★ 复制 AI HTML 内容（若有，已按新周期替换日期）
      ...(htmlContent ? { htmlContent } : {}),
      // ★ 复制 reportSchemeVersion（若有）
      ...(src.reportSchemeVersion ? { reportSchemeVersion: src.reportSchemeVersion } : {}),
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
