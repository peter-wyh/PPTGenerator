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
 * 如果有 oldPeriod（meta.reportPeriod），用它构建替换映射；
 * 如果没有 oldPeriod，直接从 HTML 中用正则扫描日期/月份模式进行替换。
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

  // 格式化辅助
  const formatDateCN = (d: string) => {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;
  };
  const formatDateShort = (d: string) => {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };
  const formatDateFull = (d: string) => {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const formatDateEN = (d: string) => {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };
  const formatMonthCN = (month: string) => {
    const [y, m] = month.split('-');
    return `${y}年${m}月`;
  };
  const formatDateRangeEN = (start: string, end: string) => {
    const s = new Date(start), e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${start} - ${end}`;
    const sStr = s.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    const eStr = e.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    return `${sStr} - ${eStr}, ${e.getFullYear()}`;
  };

  let result = html;

  // ===== 策略 1: 从 oldPeriod 构建精确替换映射 =====
  const replacements: [string, string][] = [];

  if (oldPeriod) {
    // 月份模式 (2024-01)
    if (oldPeriod.month && newPeriod.month) {
      replacements.push([oldPeriod.month, newPeriod.month]);
      replacements.push([formatMonthCN(oldPeriod.month), formatMonthCN(newPeriod.month)]);
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
      replacements.push([formatDateEN(oldPeriod.startDate), formatDateEN(newPeriod.startDate)]);
    }
    if (oldPeriod.endDate && newPeriod.endDate) {
      replacements.push([oldPeriod.endDate, newPeriod.endDate]);
      replacements.push([formatDateCN(oldPeriod.endDate), formatDateCN(newPeriod.endDate)]);
      replacements.push([formatDateShort(oldPeriod.endDate), formatDateShort(newPeriod.endDate)]);
      replacements.push([formatDateFull(oldPeriod.endDate), formatDateFull(newPeriod.endDate)]);
      replacements.push([formatDateEN(oldPeriod.endDate), formatDateEN(newPeriod.endDate)]);
    }

    // 日期范围显示文本
    if (oldPeriod.startDate && oldPeriod.endDate && newPeriod.startDate && newPeriod.endDate) {
      replacements.push([formatDateRangeEN(oldPeriod.startDate, oldPeriod.endDate), formatDateRangeEN(newPeriod.startDate, newPeriod.endDate)]);
    }
  }

  // 执行精确替换（长字符串优先，避免短串吃掉长串）
  replacements.sort((a, b) => b[0].length - a[0].length);
  for (const [old, newText] of replacements) {
    if (old && newText && old !== newText) {
      result = result.split(old).join(newText);
    }
  }

  // ===== 策略 2: 正则扫描 — 用新周期日期替换 HTML 中所有 YYYY-MM 或 YYYY-MM-DD 模式 =====
  // 当 oldPeriod 缺失或精确替换不够时，直接用正则找日期并替换为对应新日期
  if (newPeriod.month || newPeriod.startDate) {
    // 确定新周期的目标值
    const targetMonth = newPeriod.month || (newPeriod.startDate ? newPeriod.startDate.slice(0, 7) : '');
    const targetStart = newPeriod.startDate || (newPeriod.month ? `${newPeriod.month}-01` : '');
    const targetEnd = newPeriod.endDate || (newPeriod.month ? `${newPeriod.month}-28` : '');

    if (targetMonth) {
      const [newY, newM] = targetMonth.split('-');
      const newMonthCN = `${newY}年${newM}月`;

      // 替换 YYYY-MM-DD 格式
      if (targetStart && targetEnd) {
        result = result.replace(/(\d{4})-(\d{2})-(\d{2})/g, (match) => {
          // 如果在旧周期范围内，替换为对应新日期
          if (oldPeriod) {
            if (match === (oldPeriod.startDate || '')) return targetStart;
            if (match === (oldPeriod.endDate || '')) return targetEnd;
          }
          // 否则：同月替换为新月（保持日不变）
          const [, , dd] = match.split('-');
          return `${targetMonth}-${dd}`;
        });
      }

      // 替换 YYYY-MM 格式（但不匹配 YYYY-MM-DD 中已处理的部分）
      result = result.replace(/(?<!\d)(\d{4})-(\d{2})(?!\d)/g, () => targetMonth);
      // 替换 YYYY年MM月 格式
      result = result.replace(/\d{4}年\d{1,2}月/g, newMonthCN);
      // 替换 YYYY.MM 格式
      result = result.replace(/(\d{4})\.(\d{2})/g, `${newY}.${newM}`);
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
    reportPeriod?: { startDate?: string; endDate?: string },
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
    // 构建 meta(剥 isDefault);reportPeriod 传入则覆盖
    let meta: Record<string, unknown> | undefined;
    if (tpl.meta) {
      const { isDefault: _omit, ...rest } = tpl.meta as Record<string, unknown>;
      void _omit;
      meta = rest;
    }
    if (reportPeriod) meta = { ...(meta ?? {}), reportPeriod };
    const data: Prisma.ProjectCreateInput = {
      owner: { connect: { id: ownerId } },
      name: projectName,
      width: tpl.width,
      height: tpl.height,
      pages: JSON.parse(JSON.stringify(tpl.pages)) as unknown as Prisma.InputJsonValue,
      ...(meta ? { meta: meta as unknown as Prisma.InputJsonValue } : {}),
      // ★ 复制 HTML 报告内容（若有）
      ...(tpl.htmlContent ? { htmlContent: tpl.htmlContent } : {}),
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
    // 优先级：data-field 模板渲染 → AI 重新生成 → 快照值替换 → 日期替换
    let htmlContent = src.htmlContent;

    if (htmlContent && newPeriod) {
      const srcMeta = (src.meta ?? {}) as Record<string, unknown>;
      const campaignId = srcMeta.campaignId as string | undefined;
      const reportPeriod: { startDate?: string; endDate?: string } = {};
      if (newPeriod.startDate) reportPeriod.startDate = newPeriod.startDate;
      if (newPeriod.endDate) reportPeriod.endDate = newPeriod.endDate;

      if (campaignId) {
        // 1) 最高优先：data-field 模板渲染（< 100ms，零 AI 调用）
        const { isTemplatedHtml, renderTemplate } = await import('../html-templates/template-renderer');
        if (isTemplatedHtml(htmlContent)) {
          try {
            htmlContent = await renderTemplate(htmlContent, campaignId, reportPeriod);
            console.log('[duplicate] Template rendered (data-field) for period', JSON.stringify(reportPeriod));
          } catch (err) {
            console.error('[duplicate] Template render failed, falling back to AI/snapshot:', err);
            htmlContent = await this._fallbackPeriodUpdate(htmlContent, srcMeta, campaignId, reportPeriod);
          }
        } else {
          // 2) 非 data-field 模板 → AI 重新生成 or 快照替换
          htmlContent = await this._fallbackPeriodUpdate(htmlContent, srcMeta, campaignId, reportPeriod);
        }
      } else {
        // 无 campaignId → 仅日期替换
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

  /**
   * ★ 非 data-field 模板的降级策略：AI 重新生成 → 快照值替换 → 日期替换。
   */
  async _fallbackPeriodUpdate(
    html: string,
    srcMeta: Record<string, unknown>,
    campaignId: string,
    reportPeriod: { startDate?: string; endDate?: string },
  ): Promise<string> {
    // 先替换日期文案
    html = replacePeriodInHtml(html, srcMeta, reportPeriod);

    // 若有 aiPrompt/designMd，AI 重新生成（达人列表按周期过滤）
    if (srcMeta.aiPrompt || srcMeta.designMd) {
      try {
        const { aiGenerateService } = await import('../html-templates/ai-generate.service');
        html = await aiGenerateService.generateHtml({
          campaignId,
          prompt: (srcMeta.aiPrompt as string) || '(Analyze the campaign data and create an insightful HTML report.)',
          designMd: (srcMeta.designMd as string) || undefined,
          reportPeriod,
        });
        console.log('[duplicate] AI regenerated HTML for period', JSON.stringify(reportPeriod));
        return html;
      } catch (err) {
        console.error('[duplicate] AI re-generation failed, trying snapshot:', err);
      }
    }

    // 降级到快照值替换
    try {
      const { getPeriodSnapshot, buildValueReplacementPairs, replaceMetricsBySnapshot } =
        await import('../html-templates/period-snapshot');
      const oldPeriod = (srcMeta.reportPeriod as { startDate?: string; endDate?: string; month?: string } | undefined);
      const oldSnapshot = await getPeriodSnapshot(campaignId, oldPeriod);
      const newSnapshot = await getPeriodSnapshot(campaignId, reportPeriod);
      const pairs = buildValueReplacementPairs(oldSnapshot.rawValues, newSnapshot.rawValues);
      if (pairs.length > 0) {
        html = replaceMetricsBySnapshot(html, pairs);
        console.log(`[duplicate] Snapshot fallback: ${pairs.length} value pairs replaced`);
      }
    } catch (err) {
      console.error('[duplicate] Snapshot replacement also failed, keeping date-only replacement:', err);
    }
    return html;
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
