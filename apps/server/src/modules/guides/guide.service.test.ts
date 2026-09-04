import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  guide: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  campaign: { findUnique: vi.fn() },
  businessLine: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { guideService, resolveForCampaign, extractVoiceSection, pickVoiceForCampaign, mergeGuideLayers } from './guide.service';

const mkGuide = (over: Record<string, unknown> = {}) => ({
  activeRevisionId: null,
  id: 'g1', businessLineId: 'bl1', scenario: null, name: '默认指南',
  content: '# 指南', isDefault: false, isActive: true, overridesVisual: false,
  createdAt: new Date('2026-08-01'), updatedAt: new Date('2026-08-01'),
  ...over,
});

beforeEach(() => { vi.clearAllMocks(); });

describe('guideService.pick · 匹配优先级', () => {
  it('scenario 精确匹配 > isDefault', async () => {
    prismaMock.guide.findMany.mockResolvedValue([
      mkGuide({ id: 'def', isDefault: true }),
      mkGuide({ id: 'mo', scenario: '月报' }),
    ]);
    const g = await guideService.pick('bl1', '月报');
    expect(g?.id).toBe('mo');
  });
  it('scenario 为 null 的指南不参与精确匹配(通用指南抢不走特定场景)', async () => {
    prismaMock.guide.findMany.mockResolvedValue([
      mkGuide({ id: 'def', isDefault: true, scenario: null }),
    ]);
    const g = await guideService.pick('bl1', '月报');
    expect(g?.id).toBe('def'); // 降级到默认
  });
  it('无 scenario 参数 → 直接走 isDefault', async () => {
    prismaMock.guide.findMany.mockResolvedValue([
      mkGuide({ id: 'mo', scenario: '月报' }),
      mkGuide({ id: 'def', isDefault: true }),
    ]);
    const g = await guideService.pick('bl1');
    expect(g?.id).toBe('def');
  });
  it('同优先级多条 → updatedAt 最新', async () => {
    prismaMock.guide.findMany.mockResolvedValue([
      mkGuide({ id: 'old', scenario: '月报', updatedAt: new Date('2026-08-01') }),
      mkGuide({ id: 'new', scenario: '月报', updatedAt: new Date('2026-08-10') }),
    ]);
    const g = await guideService.pick('bl1', '月报');
    expect(g?.id).toBe('new'); // findMany 按 updatedAt desc 返回,mock 顺序即返回顺序
  });
  it('isActive=false 过滤在 where;content 空串视同无指南', async () => {
    prismaMock.guide.findMany.mockResolvedValue([mkGuide({ content: '   ' })]);
    expect(await guideService.pick('bl1')).toBeNull();
    expect(prismaMock.guide.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessLineId: 'bl1', isActive: true } }),
    );
  });
  it('无默认无匹配 → null', async () => {
    prismaMock.guide.findMany.mockResolvedValue([mkGuide({ scenario: '月报' })]);
    expect(await guideService.pick('bl1')).toBeNull();
  });
});

describe('guideService CRUD · isDefault 互斥', () => {
  it('create isDefault=true → 事务内清同业务线旧默认再建', async () => {
    prismaMock.guide.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockResolvedValue([1, mkGuide({ isDefault: true })]);
    await guideService.create({ businessLineId: 'bl1', name: 'n', content: 'c', isDefault: true });
    expect(prismaMock.guide.updateMany).toHaveBeenCalledWith({
      where: { businessLineId: 'bl1', isDefault: true },
      data: { isDefault: false },
    });
  });
  it('update 设默认 → 先清后更;getOrThrow 404', async () => {
    prismaMock.guide.findUnique.mockResolvedValue(null);
    await expect(guideService.update('g404', { isDefault: true })).rejects.toThrow('Guide not found');
    prismaMock.guide.findUnique.mockResolvedValue(mkGuide());
    prismaMock.$transaction.mockResolvedValue([1, mkGuide()]);
    await guideService.update('g1', { isDefault: true });
    expect(prismaMock.guide.updateMany).toHaveBeenCalledWith({
      where: { businessLineId: 'bl1', isDefault: true },
      data: { isDefault: false },
    });
  });
});

describe('resolveForCampaign · 静默降级', () => {
  it('campaign 带 businessLine → 返回指南+名称+code', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({
      businessLineId: 'bl1',
      businessLine: { title: 'DG 好物', code: 'DG' },
    });
    prismaMock.guide.findMany.mockResolvedValue([mkGuide({ id: 'def', isDefault: true })]);
    const r = await resolveForCampaign('c1', '月报');
    expect(r.guide?.id).toBe('def');
    expect(r.businessLineName).toBe('DG 好物');
    expect(r.businessLineCode).toBe('DG');
  });
  it('Guide 查询抛错 → guide=null 不抛(生成永不因指南失败)', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ businessLineId: 'bl1', businessLine: { title: 'X', code: 'X' } });
    prismaMock.guide.findMany.mockRejectedValue(new Error('db down'));
    const r = await resolveForCampaign('c1');
    expect(r.guide).toBeNull();
    expect(r.businessLineName).toBe('X');
  });
  it('campaign 不存在 → 全空', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(null);
    const r = await resolveForCampaign('c404');
    expect(r.guide).toBeNull();
    expect(r.businessLineName).toBe('');
  });
});

describe('extractVoiceSection · 语调与术语截取', () => {
  it('取「## 语调与术语」到下一节之间', () => {
    const md = '# 指南\n## 品牌视觉\n色板\n## 语调与术语\n用「推广」不用「投放」\n自称团队\n## 展示形式偏好\n卡片';
    expect(extractVoiceSection(md)).toBe('用「推广」不用「投放」\n自称团队');
  });
  it('语调节在文末 → 取到结尾', () => {
    const md = '## 语调与术语\n克制';
    expect(extractVoiceSection(md)).toBe('克制');
  });
  it('无该节 → 空串', () => {
    expect(extractVoiceSection('## 品牌视觉\nx')).toBe('');
  });
});

describe('pickVoiceForCampaign', () => {
  it('campaign → 指南 → 语调节字符串;失败降级空串', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({ businessLineId: 'bl1', businessLine: { title: 'X', code: 'X' } });
    prismaMock.guide.findMany.mockResolvedValue([
      mkGuide({ isDefault: true, content: '## 语调与术语\n用「创作者」' }),
    ]);
    expect(await pickVoiceForCampaign('c1')).toBe('用「创作者」');
    prismaMock.campaign.findUnique.mockRejectedValue(new Error('x'));
    expect(await pickVoiceForCampaign('c1')).toBe('');
  });
});

describe('mergeGuideLayers · overridesVisual 视觉接管', () => {
  it('overridesVisual=true → LAYER 1 不注入,结构指南以「完全接管」头注入,不发 CONFLICT RULE', () => {
    const visual = mkGuide({ id: 'vis', isDefault: true, content: '# 白色设计系统' });
    const deck = mkGuide({ id: 'deck', scenario: 'dm-performance-deck', content: '# 票根 deck 指南', overridesVisual: true });
    const r = mergeGuideLayers(visual, deck);
    expect(r.content).not.toContain('白色设计系统');
    expect(r.content).toContain('fully overrides the business-line visual spec');
    expect(r.content).toContain('票根 deck 指南');
    expect(r.content).not.toContain('CONFLICT RULE');
    expect(r.used.map((g) => g.id)).toEqual(['deck']);
  });

  it('overridesVisual=false(默认) → 双层注入 + CONFLICT RULE(原行为不变)', () => {
    const visual = mkGuide({ id: 'vis', isDefault: true, content: '# 白色设计系统' });
    const struct = mkGuide({ id: 's1', content: '# 结构指南' });
    const r = mergeGuideLayers(visual, struct);
    expect(r.content).toContain('LAYER 1');
    expect(r.content).toContain('LAYER 2');
    expect(r.content).toContain('CONFLICT RULE');
    expect(r.used).toHaveLength(2);
  });

  it('visual 为 isDefault 且 structural=同一份(两职一份)→只注入一次,不受 overridesVisual 影响', () => {
    const both = mkGuide({ id: 'same', isDefault: true, content: '# 一份两职' });
    const r = mergeGuideLayers(both, both);
    expect(r.content).toContain('一份两职');
    expect(r.used).toHaveLength(1);
  });
});
