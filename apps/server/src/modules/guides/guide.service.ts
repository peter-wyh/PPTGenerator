import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';
import type { Prisma, Guide } from '@prisma/client';

/**
 * 指南匹配(确定性,不依赖 AI):
 * 0827 ID 方案——结构指南直接选(前端传 guideId),消灭自由字符串 scenario 匹配。
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

  /**
   * ★ 双层匹配（视觉层 + 结构层,可同命中）:
   *   - visual  = isDefault 指南（设计规范:品牌色/字体/组件/动效,恒注入）
   *   - structural = 指南 id 精确匹配（章节结构/展示偏好/语调,选中即叠加）
   * 同一份指南可同时承担两职(返回同一引用两处)。保持 pick() 单选行为不变(voice/recipe 链路仍用)。
   */
  async pickPair(businessLineId: string, guideId?: string): Promise<{ visual: Guide | null; structural: Guide | null }> {
    if (!businessLineId) return { visual: null, structural: null };
    const rows = await prisma.guide.findMany({
      where: { businessLineId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    const usable = rows
      .filter((r) => (r.content ?? '').trim())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const visual = usable.find((r) => r.isDefault) ?? null;
    let structural: Guide | null = null;
    if (guideId) {
      structural = usable.find((r) => r.id === guideId) ?? null;
      if (structural && visual && structural.id === visual.id) structural = visual; // 同一份两职
    }
    return { visual, structural };
  },

  /**
   * ★ 该业务线可选的结构指南列表(isDefault 视觉规范之外的启用指南)——
   * 前端「叠加结构指南」下拉动态化用。所见即所得:列 name,选 id。
   */
  async listStructural(businessLineId: string): Promise<Array<{ id: string; name: string; updatedAt: Date }>> {
    if (!businessLineId) return [];
    const rows = await prisma.guide.findMany({
      // isDefault=视觉层恒注入,不在结构下拉重复出现
      where: { businessLineId, isActive: true, isDefault: { not: true } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, updatedAt: true },
    });
    return rows.filter((r) => r.name?.trim());
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

/** 双层匹配结果:视觉规范 + 结构指南 + 业务线信息(生成链路新入口)。 */
export interface GuidePair {
  visual: Guide | null;
  structural: Guide | null;
  businessLineName: string;
  businessLineCode: string;
}

/**
 * ★ 双层版 resolveForCampaign:视觉层(isDefault 规范)恒取,结构层(guideId 精确)命中即叠加。
 * 与 resolveForCampaign 同静默降级语义。供 generate/edit + getDesignGuide 回显共用,
 * 保证「表单回显的两份」⟺「生成时注入的两份」。
 */
export async function resolvePairForCampaign(campaignId: string, guideId?: string): Promise<GuidePair> {
  try {
    const camp = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { businessLine: true },
    });
    const businessLineName = camp?.businessLine?.title || camp?.businessLine?.code || '';
    const businessLineCode = camp?.businessLine?.code ?? '';
    if (!camp?.businessLineId) return { visual: null, structural: null, businessLineName, businessLineCode };
    const pair = await guideService.pickPair(camp.businessLineId, guideId).catch(() => ({ visual: null, structural: null }));
    return { ...pair, businessLineName, businessLineCode };
  } catch (e) {
    console.warn('[guide] resolvePairForCampaign 失败,降级为无指南:', (e as Error)?.message ?? e);
    return { visual: null, structural: null, businessLineName: '', businessLineCode: '' };
  }
}

/**
 * ★ 两份指南叠为单一注入文本。分层标注职责,消除双头指挥:
 *   视觉层管长相(色/字/组件/动效) — 结构层只管骨架(章节/展示/语调),不含视觉。
 * 同一份指南两职时只注入一次。structural 为空 → 仅视觉层。
 */
export function mergeGuideLayers(visual: Guide | null, structural: Guide | null): { content: string; used: Guide[] } {
  const parts: string[] = [];
  const used: Guide[] = [];
  if (visual && (visual.content ?? '').trim()) {
    parts.push(`# ═══ LAYER 1 · VISUAL SPEC (design system — colors/fonts/components/motion) ═══\n${visual.content.trim()}`);
    used.push(visual);
  }
  if (structural && (!visual || structural.id !== visual.id) && (structural.content ?? '').trim()) {
    parts.push(`# ═══ LAYER 2 · REPORT STRUCTURE GUIDE (sections/presentation/voice — NOT visual) ═══\n${structural.content.trim()}`);
    used.push(structural);
  }
  // 双层并存时的裁决声明:两份指南同时注入时,模型须知道冲突时谁赢。
  // LAYER 2 中显式声明的「报告场景专用视觉变量」允许覆盖 LAYER 1(如 DG 报告高亮粉),
  // 其余视觉规则冲突一律 LAYER 1 胜出。
  if (visual && structural && structural.id !== visual.id) {
    return {
      content: [
        '# ═══ CONFLICT RULE ═══',
        'LAYER 1 (visual spec) is the default authority for colors/fonts/components/motion.',
        'LAYER 2 may OVERRIDE LAYER 1 only where it explicitly declares a report-specific visual variable',
        '(e.g. a "report-specific visual variables" section). For any other visual conflict, LAYER 1 WINS.',
        'LAYER 2 governs sections/structure/presentation/voice only.',
        '',
        parts.join('\n\n'),
      ].join('\n'),
      used,
    };
  }
  return { content: parts.join('\n\n'), used };
}

/**
 * ★ campaign → 业务线 → 可选结构指南列表。任何失败降级空数组(前端隐藏下拉)。
 */
export async function resolveStructuralForCampaign(
  campaignId: string,
): Promise<Array<{ id: string; name: string; updatedAt: Date }>> {
  try {
    const camp = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { businessLineId: true },
    });
    if (!camp?.businessLineId) return [];
    return await guideService.listStructural(camp.businessLineId).catch(() => []);
  } catch {
    return [];
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
