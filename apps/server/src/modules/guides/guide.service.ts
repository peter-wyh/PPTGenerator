import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Prisma, Guide } from '@prisma/client';

/**
 * 指南匹配(确定性,不依赖 AI):
 * scenario 精确匹配 > 业务线 isDefault > null。
 * scenario=null 的指南只能作为 isDefault 参与第二级(通用指南不抢特定场景)。
 * content 空串视同无指南。
 */
export const guideService = {
  async pick(businessLineId: string, scenario?: string): Promise<Guide | null> {
    if (!businessLineId) return null;
    const rows = await prisma.guide.findMany({
      where: { businessLineId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    const usable = rows
      .filter((r) => (r.content ?? '').trim())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()); // 不依赖 findMany 返回顺序
    if (!usable.length) return null;
    if (scenario) {
      const exact = usable.filter((r) => r.scenario === scenario);
      if (exact.length) return exact[0]; // 已按 updatedAt desc
    }
    return usable.find((r) => r.isDefault) ?? null;
  },

  async list(opts?: { businessLineId?: string }) {
    const where: Prisma.GuideWhereInput = {};
    if (opts?.businessLineId) where.businessLineId = opts.businessLineId;
    return prisma.guide.findMany({
      where,
      orderBy: [{ businessLineId: 'asc' }, { updatedAt: 'desc' }],
      include: { businessLine: { select: { code: true, title: true } } },
    });
  },

  async getOrThrow(id: string) {
    const rec = await prisma.guide.findUnique({ where: { id } });
    if (!rec) throw ApiError.notFound('Guide not found');
    return rec;
  },

  async create(data: { businessLineId: string; name: string; scenario?: string; content: string; isDefault?: boolean; isActive?: boolean }) {
    if (data.isDefault) {
      // 同业务线 isDefault 唯一:事务内清旧默认再建
      return prisma.$transaction([
        prisma.guide.updateMany({
          where: { businessLineId: data.businessLineId, isDefault: true },
          data: { isDefault: false },
        }),
        prisma.guide.create({ data }),
      ]).then(([, created]) => created);
    }
    return prisma.guide.create({ data });
  },

  async update(id: string, data: Partial<{ businessLineId: string; name: string; scenario: string | null; content: string; isDefault: boolean; isActive: boolean }>) {
    const rec = await this.getOrThrow(id);
    if (data.isDefault === true) {
      const blId = data.businessLineId ?? rec.businessLineId;
      return prisma.$transaction([
        prisma.guide.updateMany({
          where: { businessLineId: blId, isDefault: true },
          data: { isDefault: false },
        }),
        prisma.guide.update({ where: { id }, data }),
      ]).then(([, updated]) => updated);
    }
    return prisma.guide.update({ where: { id }, data });
  },
  // 无 remove:软停用走 PATCH isActive=false(指南被线上报告引用过,留痕)。
};

/**
 * 生成链路统一入口:campaign → businessLine → 匹配指南。
 * 任何失败静默降级(指南是增强不是依赖,生成永不因它失败)。
 */
export async function resolveForCampaign(
  campaignId: string,
  scenario?: string,
): Promise<{ guide: Guide | null; businessLineName: string; businessLineCode: string }> {
  try {
    const camp = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { businessLine: true },
    });
    const businessLineName = camp?.businessLine?.title || camp?.businessLine?.code || '';
    const businessLineCode = camp?.businessLine?.code ?? '';
    if (!camp?.businessLineId) return { guide: null, businessLineName, businessLineCode };
    const guide = await guideService.pick(camp.businessLineId, scenario).catch(() => null);
    return { guide, businessLineName, businessLineCode };
  } catch (e) {
    console.warn('[guide] resolveForCampaign 失败,降级为无指南:', (e as Error)?.message ?? e);
    return { guide: null, businessLineName: '', businessLineCode: '' };
  }
}

/** 截取指南「## 语调与术语」节(到下一 ## 或文末)。约定格式,字符串处理,不解析 Markdown。 */
export function extractVoiceSection(guideContent: string): string {
  const m = guideContent.match(/^##\s*语调与术语\s*$/m);
  if (m?.index == null) return '';
  const rest = guideContent.slice(m.index + m[0].length);
  const next = rest.match(/^##\s/m);
  return (next?.index != null ? rest.slice(0, next.index) : rest).trim();
}

/** recipe 洞察文案用:campaign → 指南 → 语调节。失败降级空串。 */
export async function pickVoiceForCampaign(campaignId: string): Promise<string> {
  try {
    const { guide } = await resolveForCampaign(campaignId);
    return guide ? extractVoiceSection(guide.content) : '';
  } catch {
    return '';
  }
}
