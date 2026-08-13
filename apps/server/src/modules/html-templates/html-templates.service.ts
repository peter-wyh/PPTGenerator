import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { TemplateStatus } from '@prisma/client';
import { getRecipe } from './recipe';
import { mapCampaign } from './recipe/campaign-report/mapper';

export interface HtmlTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  thumbnail: string | null;
  status: TemplateStatus;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HtmlTemplateDetail extends HtmlTemplateSummary {
  html: string;
}

function toSummary(t: any): HtmlTemplateSummary {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    thumbnail: t.thumbnail,
    status: t.status,
    ownerId: t.ownerId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function toDetail(t: any): HtmlTemplateDetail {
  return { ...toSummary(t), html: t.html };
}

export const htmlTemplateService = {
  async list(requesterRole: string, filters?: { status?: string; category?: string }) {
    const where: any = {};
    if (requesterRole !== 'ADMIN') {
      where.status = 'PUBLISHED';
    } else if (filters?.status) {
      where.status = filters.status as TemplateStatus;
    }
    if (filters?.category) where.category = filters.category;
    const templates = await prisma.htmlTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    return templates.map(toSummary);
  },

  async get(requesterRole: string, id: string): Promise<HtmlTemplateDetail> {
    const tpl = await prisma.htmlTemplate.findUnique({ where: { id } });
    if (!tpl) throw ApiError.notFound('HTML 模板不存在');
    if (tpl.status === 'DRAFT' && requesterRole !== 'ADMIN') {
      throw ApiError.forbidden('无权查看草稿模板');
    }
    return toDetail(tpl);
  },

  async create(
    ownerId: string,
    input: {
      name: string;
      html: string;
      description?: string;
      category?: string;
      thumbnail?: string;
      status?: TemplateStatus;
    },
  ): Promise<HtmlTemplateDetail> {
    const existing = await prisma.htmlTemplate.findFirst({
      where: { name: input.name },
      select: { id: true },
    });
    if (existing) throw ApiError.badRequest(`已存在同名 HTML 模板「${input.name}」`);
    const tpl = await prisma.htmlTemplate.create({
      data: {
        name: input.name,
        html: input.html,
        description: input.description ?? null,
        category: input.category ?? null,
        thumbnail: input.thumbnail || null,
        status: input.status ?? 'DRAFT',
        ownerId,
      },
    });
    return toDetail(tpl);
  },

  async update(
    _ownerId: string,
    id: string,
    input: {
      name?: string;
      html?: string;
      description?: string | null;
      category?: string | null;
      thumbnail?: string | null;
      status?: TemplateStatus;
    },
  ): Promise<HtmlTemplateDetail> {
    const tpl = await prisma.htmlTemplate.findUnique({ where: { id } });
    if (!tpl) throw ApiError.notFound('HTML 模板不存在');

    if (input.name !== undefined && input.name !== tpl.name) {
      const clash = await prisma.htmlTemplate.findFirst({
        where: { name: input.name, id: { not: id } },
        select: { id: true },
      });
      if (clash) throw ApiError.badRequest(`已存在同名 HTML 模板「${input.name}」`);
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.html !== undefined) data.html = input.html;
    if (input.description !== undefined) data.description = input.description;
    if (input.category !== undefined) data.category = input.category;
    if (input.thumbnail !== undefined) data.thumbnail = input.thumbnail;
    if (input.status !== undefined) data.status = input.status;

    const updated = await prisma.htmlTemplate.update({ where: { id }, data });
    return toDetail(updated);
  },

  async remove(_ownerId: string, id: string): Promise<void> {
    const tpl = await prisma.htmlTemplate.findUnique({ where: { id } });
    if (!tpl) throw ApiError.notFound('HTML 模板不存在');
    await prisma.htmlTemplate.delete({ where: { id } });
  },

  /** 保存生成的 HTML 到项目（向后兼容旧字段 + 新 HtmlVersion 表） */
  async saveHtmlToProject(projectId: string, _ownerId: string, html: string): Promise<void> {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw ApiError.notFound('报告不存在');
    await prisma.project.update({
      where: { id: projectId },
      data: {
        htmlContent: html,
        meta: {
          ...(project.meta as object),
          styleType: 'ai-html',
          updatedAt: new Date().toISOString(),
        },
      },
    });
  },

  /**
   * 自动保存 HTML 到报告（Agent 模式专用）。
   * 直接更新 project.htmlContent，不创建 HtmlVersion。
   * 同时更新 meta.updatedAt 时间戳，使报告列表按编辑时间排序。
   */
  async autoSaveHtml(
    projectId: string,
    html: string,
    agentHistory?: unknown[],
    aiPrompt?: string,
    designMd?: string,
  ): Promise<{ ok: true; updatedAt: string }> {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw ApiError.notFound('报告不存在');

    const currentMeta = (project.meta as Record<string, unknown> | null) ?? {};
    const newMeta: Record<string, unknown> = {
      ...currentMeta,
      styleType: 'ai-html',
      updatedAt: new Date().toISOString(),
    };
    if (agentHistory !== undefined) {
      newMeta.agentHistory = agentHistory;
    }
    // ★ 存储 AI 生成参数，供 duplicate 时重新生成用
    if (aiPrompt !== undefined) {
      newMeta.aiPrompt = aiPrompt;
    }
    if (designMd !== undefined) {
      newMeta.designMd = designMd;
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        htmlContent: html,
        meta: newMeta as any,
      },
    });

    return { ok: true, updatedAt: new Date().toISOString() };
  },

  // ─── HtmlVersion 多版本管理 ───────────────────────────

  /** 保存 HTML（覆盖当前激活版本 或 新增版本） */
  async saveHtmlVersion(
    projectId: string,
    ownerId: string,
    html: string,
    opts: { name?: string; source?: string; mode?: 'overwrite' | 'new' },
  ) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw ApiError.notFound('报告不存在');

    const mode = opts.mode || 'overwrite';
    const versionName = opts.name || `版本 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;

    // 如果项目有旧 htmlContent 但还没有 HtmlVersion → 自动迁移为第一个版本
    const existingVersions = await prisma.htmlVersion.findMany({ where: { projectId } });
    if (existingVersions.length === 0 && project.htmlContent) {
      await prisma.htmlVersion.create({
        data: {
          projectId,
          ownerId,
          name: '初始版本',
          html: project.htmlContent,
          isActive: true,
        },
      });
    }

    let version;
    if (mode === 'new') {
      // 新增版本：取消其他版本的 isActive
      await prisma.htmlVersion.updateMany({
        where: { projectId },
        data: { isActive: false },
      });
      version = await prisma.htmlVersion.create({
        data: {
          projectId,
          ownerId,
          name: versionName,
          html,
          source: opts.source || null,
          isActive: true,
        },
      });
    } else {
      // 覆盖模式：找到当前激活版本覆盖；没有则新建
      const active = await prisma.htmlVersion.findFirst({ where: { projectId, isActive: true } });
      if (active) {
        version = await prisma.htmlVersion.update({
          where: { id: active.id },
          data: {
            html,
            name: opts.name || active.name,
            source: opts.source || active.source,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.htmlVersion.updateMany({
          where: { projectId },
          data: { isActive: false },
        });
        version = await prisma.htmlVersion.create({
          data: {
            projectId,
            ownerId,
            name: versionName,
            html,
            source: opts.source || null,
            isActive: true,
          },
        });
      }
    }

    // 同步更新 project.htmlContent（向后兼容）
    await prisma.project.update({
      where: { id: projectId },
      data: {
        htmlContent: html,
        meta: { ...(project.meta as object), styleType: 'ai-html', updatedAt: new Date().toISOString() },
      },
    });

    return { ok: true, versionId: version.id, version };
  },

  /** 列出项目的所有 HTML 版本 */
  async listHtmlVersions(projectId: string) {
    const versions = await prisma.htmlVersion.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        source: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return versions;
  },

  /** 获取单个版本（含 html 内容） */
  async getHtmlVersion(versionId: string) {
    const version = await prisma.htmlVersion.findUnique({ where: { id: versionId } });
    if (!version) throw ApiError.notFound('版本不存在');
    return version;
  },

  /** 更新版本（名称/内容/激活状态） */
  async updateHtmlVersion(
    versionId: string,
    _ownerId: string,
    input: { name?: string; html?: string; isActive?: boolean },
  ) {
    const version = await prisma.htmlVersion.findUnique({ where: { id: versionId } });
    if (!version) throw ApiError.notFound('版本不存在');

    // 如果设为激活，取消同项目其他版本的 isActive
    if (input.isActive) {
      await prisma.htmlVersion.updateMany({
        where: { projectId: version.projectId, id: { not: versionId } },
        data: { isActive: false },
      });
      // 同步 project.htmlContent
      const fullVersion = await prisma.htmlVersion.findUnique({ where: { id: versionId } });
      if (fullVersion) {
        await prisma.project.update({
          where: { id: version.projectId },
          data: { htmlContent: fullVersion.html },
        });
      }
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.html !== undefined) data.html = input.html;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const updated = await prisma.htmlVersion.update({ where: { id: versionId }, data });
    return updated;
  },

  /** 删除版本 */
  async deleteHtmlVersion(versionId: string) {
    const version = await prisma.htmlVersion.findUnique({ where: { id: versionId } });
    if (!version) throw ApiError.notFound('版本不存在');
    const wasActive = version.isActive;

    await prisma.htmlVersion.delete({ where: { id: versionId } });

    // 如果删的是激活版本，自动激活最新的
    if (wasActive) {
      const latest = await prisma.htmlVersion.findFirst({
        where: { projectId: version.projectId },
        orderBy: { createdAt: 'desc' },
      });
      if (latest) {
        await prisma.htmlVersion.update({ where: { id: latest.id }, data: { isActive: true } });
        await prisma.project.update({
          where: { id: version.projectId },
          data: { htmlContent: latest.html },
        });
      }
    }
  },

  /** 从 Campaign 创建新报告并保存 HTML */
  async saveHtmlAsNewProject(
    ownerId: string,
    input: {
      html: string;
      campaignId: string;
      name: string;
      businessLine?: string;
      creator?: string;
      advertiser?: string;
      scenario?: string;
      scenarioSub?: string;
    },
  ) {
    const trimmedName = input.name.trim();
    if (!trimmedName) throw ApiError.badRequest('报告名称不能为空');
    const existing = await prisma.project.findFirst({
      where: { name: trimmedName },
      select: { id: true },
    });
    if (existing)
      throw ApiError.badRequest(`已存在同名报告「${trimmedName}」，请使用其他名称`);

    // 查 campaign 填充默认 meta（用户显式传入的字段优先）
    const campaign = await prisma.campaign.findUnique({
      where: { id: input.campaignId },
      include: { businessLine: true, advertiser: true },
    });
    const meta: Record<string, any> = {
      styleType: 'ai-html',
      campaignId: input.campaignId,
      renderType: 'html-report',
      scenario: input.scenario || 'campaign-report',
      scenarioSub: input.scenarioSub,
      createdAt: new Date().toISOString(),
    };
    if (input.businessLine) {
      meta.businessLine = input.businessLine;
    } else if (campaign) {
      meta.businessLine = campaign.businessLine?.name ?? campaign.businessLineCode;
    }
    if (input.advertiser) {
      meta.advertiser = input.advertiser;
    } else if (campaign) {
      meta.advertiser = campaign.advertiser?.name ?? campaign.advertiserName;
    }
    if (input.creator) {
      meta.creator = input.creator;
    }
    const project = await prisma.project.create({
      data: {
        name: trimmedName,
        width: 1280,
        height: 800,
        ownerId,
        htmlContent: input.html,
        meta,
        pages: [],
      },
    });
    return project;
  },

  /**
   * 保存 recipe 配置(reportContent/tokenOverrides/manifestOverrides)到 HtmlVersion,
   * 触发重渲染并写回 html。campaignId 从 Project.meta 取。
   * 仅 recipe 版本(recipeId 非空)可用;未传字段沿用 version 现值。
   */
  async saveRecipeConfig(
    versionId: string,
    cfg: {
      reportContent?: any;
      tokenOverrides?: Record<string, any>;
      manifestOverrides?: { order?: string[]; hidden?: string[] };
    },
  ): Promise<void> {
    const version = await prisma.htmlVersion.findUnique({
      where: { id: versionId },
    });
    if (!version) throw ApiError.notFound('HTML 版本不存在');
    if (!version.recipeId)
      throw ApiError.badRequest('该版本不是 recipe 报告');

    // 未传字段沿用现值
    const reportContent = cfg.reportContent ?? version.reportContent;
    const tokenOverrides =
      cfg.tokenOverrides ?? (version.tokenOverrides as Record<string, any> | null);
    const manifestOverrides =
      cfg.manifestOverrides ?? (version.manifestOverrides as any | null);

    // campaignId 从 Project.meta 取
    const project = await prisma.project.findUnique({
      where: { id: version.projectId },
      select: { meta: true },
    });
    const meta = (project?.meta as Record<string, unknown> | null) ?? {};
    const campaignId = (meta.campaignId as string | undefined) ?? '';

    const html = await getRecipe(version.recipeId).render({
      campaignId,
      reportContent,
      tokenOverrides: tokenOverrides ?? undefined,
      manifestOverrides: manifestOverrides ?? undefined,
    });

    // Json? 列不接受 JS null(需 Prisma.JsonNull);为空时直接 omit
    const data: Record<string, unknown> = { html };
    if (reportContent !== undefined && reportContent !== null)
      data.reportContent = reportContent;
    if (tokenOverrides) data.tokenOverrides = tokenOverrides;
    if (manifestOverrides) data.manifestOverrides = manifestOverrides;

    await prisma.htmlVersion.update({
      where: { id: versionId },
      data: data as any,
    });
  },

  /**
   * 创建一个 recipe 版本并设为 active:跑 mapCampaign → reportContent,
   * render → html,停用同 project 其它 active 版本后建版本,同步 meta.reportPeriod。
   */
  async createRecipeVersion(
    projectId: string,
    ownerId: string,
    opts: { recipeId?: string; reportPeriod?: { startDate?: string; endDate?: string } },
  ): Promise<{ versionId: string }> {
    const recipeId = opts.recipeId ?? 'campaign-report';
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { meta: true },
    });
    if (!project) throw ApiError.notFound('报告不存在');
    const meta = (project.meta as Record<string, unknown> | null) ?? {};
    const campaignId = meta.campaignId as string | undefined;
    if (!campaignId) {
      throw ApiError.badRequest('报告未绑定 Campaign,无法生成 recipe 报告');
    }
    const reportPeriod =
      opts.reportPeriod ?? (meta.reportPeriod as { startDate?: string; endDate?: string } | undefined);

    const reportContent = await mapCampaign(campaignId, reportPeriod);
    const html = await getRecipe(recipeId).render({ campaignId, reportContent });

    await prisma.htmlVersion.updateMany({
      where: { projectId, isActive: true },
      data: { isActive: false },
    });
    const version = await prisma.htmlVersion.create({
      data: { projectId, ownerId, name: 'Recipe 版本', recipeId, reportContent, html, isActive: true },
    });
    const newMeta = reportPeriod ? { ...meta, reportPeriod } : meta;
    await prisma.project.update({ where: { id: projectId }, data: { meta: newMeta as any } });
    return { versionId: version.id };
  },

  /**
   * 按新 reportPeriod 重算 recipe 版本:重跑 mapCampaign 覆盖 reportContent + html,
   * 同步 Project.meta.reportPeriod。仅 recipe 版本可用。
   */
  async recomputeRecipe(
    versionId: string,
    reportPeriod: { startDate?: string; endDate?: string },
  ): Promise<{ versionId: string }> {
    const version = await prisma.htmlVersion.findUnique({ where: { id: versionId } });
    if (!version) throw ApiError.notFound('HTML 版本不存在');
    if (!version.recipeId) throw ApiError.badRequest('该版本不是 recipe 报告');

    const project = await prisma.project.findUnique({
      where: { id: version.projectId },
      select: { meta: true },
    });
    const meta = (project?.meta as Record<string, unknown> | null) ?? {};
    const campaignId = (meta.campaignId as string | undefined) ?? '';
    if (!campaignId) throw ApiError.badRequest('报告未绑定 Campaign,无法重算');

    const reportContent = await mapCampaign(campaignId, reportPeriod);
    const html = await getRecipe(version.recipeId).render({ campaignId, reportContent });

    await prisma.htmlVersion.update({ where: { id: versionId }, data: { reportContent, html } });
    await prisma.project.update({
      where: { id: version.projectId },
      data: { meta: { ...meta, reportPeriod } as any },
    });
    return { versionId };
  },
};
