import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { TemplateStatus } from '@prisma/client';

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

  /** 模板模式：将 campaign 数据填充到模板占位符 */
  async generateFromTemplate(templateId: string, campaignData: Record<string, any>): Promise<string> {
    const tpl = await prisma.htmlTemplate.findUnique({ where: { id: templateId } });
    if (!tpl) throw ApiError.notFound('HTML 模板不存在');
    if (tpl.status === 'DRAFT') throw ApiError.badRequest('模板未发布，无法用于生成');

    // 简单变量替换：{{key}} → campaignData[key]
    let html = tpl.html;
    const flattenData = flattenObject(campaignData);
    for (const [key, value] of Object.entries(flattenData)) {
      const placeholder = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'g');
      html = html.replace(placeholder, String(value ?? ''));
    }
    return html;
  },

  /** 保存生成的 HTML 到项目 */
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
};

function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      result[newKey] = value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : v)).join(', ');
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
