import { describe, it, expect } from 'vitest';
import {
  campaignRecordDataSchema,
  creatorRecordDataSchema,
  kindSchema,
  createDataSchema,
  importDataSchema,
  updateDataSchema,
} from './data.schema';

const validCampaign = {
  id: 'camp-x',
  name: 'Campaign X',
  advertiser: 'GlowLab',
  businessLine: 'FT',
  platform: 'TikTok',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  budget: '$100K',
};
const validCreator = {
  id: 'cre-x',
  name: 'Mia',
  handle: '@mia',
  platform: 'TikTok',
  tier: 'mega',
  followers: '1.28M',
  engagement: '8.7%',
  category: 'Beauty',
  region: 'US',
};

describe('data.schema · kindSchema', () => {
  it('接受 campaign / creator,拒绝其它', () => {
    expect(kindSchema.parse('campaign')).toBe('campaign');
    expect(kindSchema.parse('creator')).toBe('creator');
    expect(() => kindSchema.parse('product')).toThrow();
  });
});

describe('data.schema · campaignRecordDataSchema(镜像 Campaign)', () => {
  it('合法 campaign(含可选 metrics/platforms)通过', () => {
    const c = { ...validCampaign, status: 'Active', owner: 'alex', metrics: [{ label: 'GMV', value: '$1', compare: '+1%' }], platforms: [{ platform: 'TikTok', collaborationType: 'Content' }] };
    expect(campaignRecordDataSchema.parse(c)).toEqual(c);
  });
  it('缺必填 name → 报错', () => {
    const { name, ...bad } = validCampaign;
    expect(() => campaignRecordDataSchema.parse(bad)).toThrow();
  });
  it('metrics 项缺 compare → 报错(CampaignMetric 三字段必填)', () => {
    const c = { ...validCampaign, metrics: [{ label: 'GMV', value: '$1' }] };
    expect(() => campaignRecordDataSchema.parse(c)).toThrow();
  });
});

describe('data.schema · creatorRecordDataSchema(镜像 Creator)', () => {
  it('合法 creator(含 avatar + metrics[])通过', () => {
    const cr = { ...validCreator, avatar: 'https://x', metrics: [{ label: 'Avg Reach', value: '1M', compare: '' }] };
    expect(creatorRecordDataSchema.parse(cr)).toEqual(cr);
  });
  it('缺 metrics → 报错(Creator.metrics 必填)', () => {
    const { metrics, ...bad } = { ...validCreator, metrics: [] } as Record<string, unknown>;
    void metrics;
    expect(() => creatorRecordDataSchema.parse(bad)).toThrow();
  });
  it('缺必填 tier → 报错', () => {
    const { tier, ...bad } = validCreator;
    expect(() => creatorRecordDataSchema.parse(bad)).toThrow();
  });
});

describe('data.schema · 端点入参 schema', () => {
  it('createDataSchema: kind + data(unknown)通过', () => {
    expect(createDataSchema.parse({ kind: 'campaign', data: validCampaign })).toEqual({ kind: 'campaign', data: validCampaign });
  });
  it('importDataSchema: kind + items[] 通过', () => {
    const r = importDataSchema.parse({ kind: 'creator', items: [validCreator] });
    expect(r.items).toHaveLength(1);
  });
  it('importDataSchema: items 非数组 → 报错', () => {
    expect(() => importDataSchema.parse({ kind: 'creator', items: {} })).toThrow();
  });
  it('updateDataSchema: { data } 通过', () => {
    expect(updateDataSchema.parse({ data: validCampaign })).toEqual({ data: validCampaign });
  });
});
