import { describe, it, expect } from 'vitest';
import { resolvePageCreator, resolvePageCampaign, COMPONENT_BINDING_KIND, campaignPatch, creatorPatch, applyPageBinding } from '../src/editor/pageBinding';
import type { Page, ReportDataContext, ReportCreator, EditorComponent } from '@mediakit/shared';

const rd: ReportDataContext = {
  campaign: { id: 'camp-1', name: 'GlowLab', metrics: [] } as any,
  campaignCreators: [{ id: 'cr-1', name: 'Ada', stats: [] } as any],
  creators: [{ id: 'cr-2', name: 'Bo', stats: [] } as any],
};

describe('resolvePageCreator', () => {
  it('按 page.creatorId 从合并达人列表解析', () => {
    const page = { id: 'p', name: 'n', creatorId: 'cr-2' } as Page;
    expect(resolvePageCreator(page, rd)?.id).toBe('cr-2');
  });
  it('campaignCreators 优先于 creators（同 id 去重）', () => {
    const rd2: ReportDataContext = {
      campaignCreators: [{ id: 'dup', name: 'FromCampaign' } as any],
      creators: [{ id: 'dup', name: 'FromLib' } as any],
    };
    const page = { id: 'p', name: 'n', creatorId: 'dup' } as Page;
    expect(resolvePageCreator(page, rd2)?.name).toBe('FromCampaign');
  });
  it('无绑定 / 找不到 → undefined', () => {
    expect(resolvePageCreator({ id: 'p', name: 'n' } as Page, rd)).toBeUndefined();
    expect(resolvePageCreator({ id: 'p', name: 'n', creatorId: 'nope' } as Page, rd)).toBeUndefined();
  });
});

describe('resolvePageCampaign', () => {
  it('page.campaignId 命中全局 campaign', () => {
    expect(resolvePageCampaign({ id: 'p', name: 'n', campaignId: 'camp-1' } as Page, rd)?.id).toBe('camp-1');
  });
  it('不匹配 → undefined', () => {
    expect(resolvePageCampaign({ id: 'p', name: 'n', campaignId: 'other' } as Page, rd)).toBeUndefined();
  });
});

describe('COMPONENT_BINDING_KIND', () => {
  it('creator 型 / campaign 型 / project 型 / 其余 undefined', () => {
    expect(COMPONENT_BINDING_KIND['creator-avatar-card']).toBe('creator');
    expect(COMPONENT_BINDING_KIND['kpi-board']).toBe('campaign');
    expect(COMPONENT_BINDING_KIND['text']).toBe('project');
    expect(COMPONENT_BINDING_KIND['strategy-block']).toBe('project');
    expect(COMPONENT_BINDING_KIND['image']).toBeUndefined();
  });
});

const campaign = { id: 'camp-1', name: 'GlowLab', metrics: [{ label: 'Spend', value: '$1k', compare: '' }] } as any;

describe('campaignPatch', () => {
  it('funnel-chart 返回 { steps }', () => {
    expect(campaignPatch('funnel-chart', campaign)).toHaveProperty('steps');
  });
  it('kpi-board 用 metricsToRows 生成 headers/rows', () => {
    const p = campaignPatch('kpi-board', campaign);
    expect(p).toHaveProperty('headers');
    expect(p).toHaveProperty('rows');
  });
  it('无 metrics 的 campaign 对 kpi-board 返回 null', () => {
    expect(campaignPatch('kpi-board', { id: 'c', name: 'n' } as any)).toBeNull();
  });
  it('未登记类型返回 null', () => {
    expect(campaignPatch('text', campaign)).toBeNull();
  });
});

const cr = {
  id: 'cr-1', name: 'Ada', handle: '@ada', platform: 'TikTok', tier: 'macro',
  followers: '1M', engagement: '5%', category: 'Beauty', region: 'US', avatar: 'http://x/a.png',
  stats: [{ label: 'Followers', value: '1M', compare: '' }] as any,
  audience: {
    genderSplit: [{ label: 'F', value: 60, color: 'auto' }] as any,
    ageRange: [{ label: '18-24', value: 30, color: 'auto' }] as any,
  },
} as unknown as ReportCreator;

describe('creatorPatch', () => {
  it('creator-avatar-card 填 7 字段', () => {
    const p = creatorPatch('creator-avatar-card', cr, 'camp-1') as any;
    expect(p).toMatchObject({ name: 'Ada', handle: '@ada', followers: '1M', avatar: 'http://x/a.png' });
    expect(p.intro).toContain('Beauty');
  });
  it('creator-stats-strip 镜像 stats（无 stats → null）', () => {
    expect(creatorPatch('creator-stats-strip', cr, 'camp-1')).toHaveProperty('stats');
    expect(creatorPatch('creator-stats-strip', { ...cr, stats: [] } as any, 'camp-1')).toBeNull();
  });
  it('creator-fan-gender / fan-age 从 audience 取', () => {
    expect(creatorPatch('creator-fan-gender', cr, 'camp-1')).toHaveProperty('slices');
    expect(creatorPatch('creator-fan-age', cr, 'camp-1')).toHaveProperty('bars');
  });
  it('creator-fan-gender 无 audience 数据 → null', () => {
    expect(creatorPatch('creator-fan-gender', { ...cr, audience: {} } as any, 'camp-1')).toBeNull();
  });
  it('meta-strip 生成 rows（至少 1 行）', () => {
    const p = creatorPatch('meta-strip', cr, 'camp-1') as any;
    expect(p.rows.length).toBeGreaterThanOrEqual(1);
  });
  it('未登记类型 → null', () => {
    expect(creatorPatch('text', cr, 'camp-1')).toBeNull();
  });
});

const mkComp = (type: string, dataSource?: string): EditorComponent =>
  ({ id: `c-${type}`, type, x: 0, y: 0, w: 10, h: 10, data: { ...(dataSource ? { _dataSource: dataSource } : {}) } }) as any;

describe('applyPageBinding reducer', () => {
  const rd2 = {
    campaign: { id: 'camp-1', name: 'G', metrics: [{ label: 'Spend', value: '$1', compare: '' }] } as any,
    campaignCreators: [{ id: 'cr-1', name: 'Ada', platform: 'TikTok', stats: [{ label: 'F', value: '1', compare: '' }] } as any],
  } as any;

  it('新增组件（无 _dataSource）在绑定页 → 被填充 + _dataSource=project', () => {
    const pages: Page[] = [{ id: 'p1', name: 'n', creatorId: 'cr-1', components: [mkComp('creator-stats-strip')] } as any];
    const out = applyPageBinding(pages, 'p1', rd2, new Set(['c-creator-stats-strip']));
    const c = out[0].components[0];
    expect((c.data as any)._dataSource).toBe('project');
    expect((c.data as any).stats).toBeDefined();
  });
  it('source=project 的组件在绑定变化时重填', () => {
    const pages: Page[] = [{ id: 'p1', name: 'n', creatorId: 'cr-1', components: [mkComp('creator-stats-strip', 'project')] } as any];
    const out = applyPageBinding(pages, 'p1', rd2, new Set()); // 不传「新增」集合 → 只看 source=project
    expect((out[0].components[0].data as any).stats).toBeDefined();
    expect((out[0].components[0].data as any)._dataSource).toBe('project');
  });
  it('source=manual 的组件不被覆盖', () => {
    const pages: Page[] = [{ id: 'p1', name: 'n', creatorId: 'cr-1', components: [mkComp('creator-stats-strip', 'manual')] } as any];
    const out = applyPageBinding(pages, 'p1', rd2, new Set());
    expect((out[0].components[0].data as any).stats).toBeUndefined();
  });
  it('project 型（text）在有 campaign 数据时被填充', () => {
    const pages: Page[] = [{ id: 'p1', name: 'n', creatorId: 'cr-1', components: [mkComp('text')] } as any];
    const out = applyPageBinding(pages, 'p1', rd2, new Set(['c-text']));
    expect(out[0].components[0].data).toHaveProperty('_dataSource', 'project');
    expect((out[0].components[0].data as any).content).toContain('G'); // campaign name
  });
  it('project 型（text）无 campaign 数据 → 不动', () => {
    const pages: Page[] = [{ id: 'p1', name: 'n', components: [mkComp('text')] } as any];
    const emptyRd = {} as any;
    expect(applyPageBinding(pages, 'p1', emptyRd, new Set(['c-text']))).toBe(pages); // 原样返回
  });
  it('无绑定的页面 → 原样返回', () => {
    const pages: Page[] = [{ id: 'p1', name: 'n', components: [mkComp('creator-stats-strip')] } as any];
    expect(applyPageBinding(pages, 'p1', rd2, new Set(['c-creator-stats-strip']))).toEqual(pages);
  });
  it('找不到 pageId → 原样返回', () => {
    const pages: Page[] = [{ id: 'p1', name: 'n', creatorId: 'cr-1', components: [] } as any];
    expect(applyPageBinding(pages, 'nope', rd2, new Set())).toEqual(pages);
  });
});
